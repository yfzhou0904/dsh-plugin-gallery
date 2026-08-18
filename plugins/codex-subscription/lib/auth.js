/**
 * Reading and refreshing the Codex CLI's local credentials.
 *
 * Credentials come from the codex CLI's own `~/.codex/auth.json` (CODEX_HOME
 * overrides it). Sharing that file with the CLI is what makes the user's
 * existing codex login work here for free: log in, log out, or switch accounts
 * in the CLI and this plugin's next request follows. The file holds one of two
 * shapes:
 *
 * - `OPENAI_API_KEY` (auth_mode: apikey) -> official API: `api.openai.com/v1/responses`
 * - `tokens` (auth_mode: chatgpt) -> ChatGPT subscription: `chatgpt.com/backend-api/codex/responses`,
 *   Bearer `tokens.access_token` + `chatgpt-account-id: tokens.account_id`
 *
 * When a subscription access_token expires (HTTP 401), `tokens.refresh_token`
 * is exchanged once at `auth.openai.com/oauth/token`. On success the new token
 * is written back to auth.json atomically by default — the codex CLI does the
 * same, keeping both sides consistent — which `writeBack: false` disables.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LlmError } from '@deepseek-ai/dsh-llm';

import {
  CHATGPT_BASE_URL,
  CODEX_OAUTH_CLIENT_ID,
  CODEX_OAUTH_TOKEN_URL,
  OPENAI_API_BASE_URL,
} from './constants.js';

const REFRESH_TIMEOUT_MS = 15_000;

/** Resolve the Codex config directory: explicit config > CODEX_HOME > ~/.codex. */
export function codexHomeDir(override) {
  if (typeof override === 'string' && override.trim().length > 0) return override;
  const env = process.env.CODEX_HOME;
  if (typeof env === 'string' && env.trim().length > 0) return env;
  return path.join(os.homedir(), '.codex');
}

export function defaultAuthFile(override) {
  if (typeof override === 'string' && override.trim().length > 0) return override;
  return path.join(codexHomeDir(), 'auth.json');
}

export function defaultModelsCacheFile(override) {
  if (typeof override === 'string' && override.trim().length > 0) return override;
  return path.join(codexHomeDir(), 'models_cache.json');
}

/** Read the codex CLI's auth.json; throws MISSING_CREDENTIAL when absent or corrupt. */
export async function readAuthFile(authFile) {
  let raw;
  try {
    raw = await readFile(authFile, 'utf8');
  } catch (error) {
    throw new LlmError(
      `Cannot read the Codex credential file ${authFile}: run "codex login" to sign in first, or switch to OPENAI_API_KEY.`,
      'MISSING_CREDENTIAL',
      { cause: error },
    );
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new LlmError(`The Codex credential file ${authFile} is not valid JSON.`, 'MISSING_CREDENTIAL', { cause: error });
  }
}

/**
 * Work out which credential shape auth.json currently holds.
 * The precedence matches the codex CLI: an explicit auth_mode wins; otherwise
 * an OPENAI_API_KEY means API key mode, and tokens mean ChatGPT subscription.
 */
export function resolveCredentials(auth) {
  const mode = typeof auth?.auth_mode === 'string' ? auth.auth_mode : undefined;
  const apiKey =
    typeof auth?.OPENAI_API_KEY === 'string' && auth.OPENAI_API_KEY.trim().length > 0
      ? auth.OPENAI_API_KEY.trim()
      : undefined;
  const tokens = auth?.tokens;
  const accessToken =
    tokens && typeof tokens.access_token === 'string' && tokens.access_token.length > 0
      ? tokens.access_token
      : undefined;

  if (mode === 'apikey' || (mode === undefined && apiKey && !accessToken)) {
    if (!apiKey) throw new LlmError('Codex auth.json has no OPENAI_API_KEY.', 'MISSING_CREDENTIAL');
    return { mode: 'apikey', apiKey, baseURL: OPENAI_API_BASE_URL };
  }

  if (mode === 'chatgpt' || accessToken) {
    if (!accessToken) throw new LlmError('Codex auth.json has no tokens.access_token.', 'MISSING_CREDENTIAL');
    return {
      mode: 'chatgpt',
      accessToken,
      refreshToken:
        tokens && typeof tokens.refresh_token === 'string' && tokens.refresh_token.length > 0
          ? tokens.refresh_token
          : undefined,
      accountId:
        tokens && typeof tokens.account_id === 'string' && tokens.account_id.length > 0
          ? tokens.account_id
          : undefined,
      baseURL: CHATGPT_BASE_URL,
    };
  }

  throw new LlmError(
    'Codex auth.json has neither OPENAI_API_KEY nor tokens; run "codex login" first.',
    'MISSING_CREDENTIAL',
  );
}

/** Refresh ChatGPT subscription tokens via the refresh_token grant at auth.openai.com. */
export async function refreshChatgptTokens(refreshToken, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(CODEX_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CODEX_OAUTH_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LlmError('The Codex token refresh request failed', 'TRANSPORT', { cause: error });
  }
  const bodyText = await response.text();
  if (!response.ok) {
    throw new LlmError(
      `Codex token refresh failed (HTTP ${response.status}): ${bodyText.slice(0, 200)}`,
      'AUTH',
      { status: response.status },
    );
  }
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new LlmError('The Codex token refresh returned an unparseable response.', 'AUTH');
  }
  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new LlmError('The Codex token refresh response has no access_token.', 'AUTH');
  }
  return {
    accessToken: data.access_token,
    refreshToken:
      typeof data.refresh_token === 'string' && data.refresh_token.length > 0
        ? data.refresh_token
        : refreshToken,
    expiresIn: typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : undefined,
  };
}

/** Write auth.json back atomically (temp file + rename), preserving unknown fields and updating only tokens/last_refresh. */
export async function writeBackTokens(authFile, auth, refreshed) {
  const next = { ...auth };
  const tokens = { ...(auth.tokens ?? {}) };
  tokens.access_token = refreshed.accessToken;
  tokens.refresh_token = refreshed.refreshToken;
  if (typeof auth.tokens?.id_token === 'string') tokens.id_token = auth.tokens.id_token;
  if (typeof auth.tokens?.account_id === 'string') tokens.account_id = auth.tokens.account_id;
  next.tokens = tokens;
  next.last_refresh = new Date().toISOString();
  if (typeof next.auth_mode === 'string' && next.auth_mode !== 'chatgpt') next.auth_mode = 'chatgpt';
  const tmp = `${authFile}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(tmp, authFile);
}

/**
 * Codex credential manager: re-reads auth.json on every request to stay in sync
 * with the codex CLI, and on a 401 refreshes once with refresh_token, writing
 * back to auth.json by default. Concurrent refreshes are deduplicated through a
 * shared in-flight promise.
 */
export class CodexCredentials {
  /**
   * @param config - A config object, or a thunk returning one, so that
   *   hot-reloaded settings are re-evaluated on every request. Fields:
   *   `authFile`, `writeBack` (default true), `fetch`.
   */
  constructor(config) {
    this._options = typeof config === 'function' ? config : () => config ?? {};
    this._refreshing = undefined;
  }

  #options() {
    return this._options();
  }

  get fetchImpl() {
    const opts = this.#options();
    return typeof opts.fetch === 'function' ? opts.fetch : fetch;
  }

  get authFile() {
    return defaultAuthFile(this.#options().authFile);
  }

  get writeBack() {
    return this.#options().writeBack !== false;
  }

  /** Resolve the current credentials; throws MISSING_CREDENTIAL when auth.json is missing. */
  async current() {
    const auth = await readAuthFile(defaultAuthFile(this.#options().authFile));
    return resolveCredentials(auth);
  }

  /** Refresh ChatGPT subscription tokens; throws AUTH on failure. Concurrent calls share one refresh. */
  refresh() {
    if (this._refreshing !== undefined) return this._refreshing;
    this._refreshing = this.#doRefresh().finally(() => {
      this._refreshing = undefined;
    });
    return this._refreshing;
  }

  async #doRefresh() {
    const config = this.#options();
    const authFile = defaultAuthFile(config.authFile);
    const auth = await readAuthFile(authFile);
    const creds = resolveCredentials(auth);
    if (creds.mode !== 'chatgpt' || !creds.refreshToken) {
      throw new LlmError('The current Codex credentials are not in ChatGPT subscription mode and cannot be refreshed.', 'AUTH');
    }
    const refreshed = await refreshChatgptTokens(creds.refreshToken, this.fetchImpl);
    if (config.writeBack !== false) {
      try {
        await writeBackTokens(authFile, auth, refreshed);
      } catch (error) {
        // A failed write-back is not fatal: this request keeps using the new
        // in-memory token, and the next restart refreshes again.
        console.error(`[dsh-llm-codex] writing back to ${authFile} failed:`, error?.message ?? error);
      }
    }
    return { ...creds, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
  }
}
