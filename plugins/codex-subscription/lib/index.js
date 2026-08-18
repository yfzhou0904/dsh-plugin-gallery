/**
 * dsh-llm-codex-subscription: registers a `codex` LLM provider in DSH that
 * reuses the Codex CLI's local login (~/.codex/auth.json), putting ChatGPT
 * subscription models (gpt-5.6-sol and friends) straight into DSH's model
 * picker.
 *
 * Composition (structured like @deepseek-ai/dsh-llm-deepseek):
 *   - id: llm-codex
 *     name: dsh-llm-codex
 *
 * Optional config, hot-reloaded, from the composer row's config or the
 * `llm-codex-subscription:` section of settings.yaml:
 *   - clientVersion: codex wire version (default 0.144.1)
 *   - writeBack:     write refreshed subscription tokens back to auth.json (default true)
 *   - authFile:      override the auth.json path
 *   - account:       select an account alias, resolved through the accounts map
 *   - accounts:      map of account aliases to auth.json paths
 *   - modelsCacheFile: override the models_cache.json path
 *   - staticModels:  explicit model catalog, overriding discovery
 */

import z from '@deepseek-ai/schemastery';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout';

import { CodexAdapter } from './adapter.js';
import { CodexCredentials } from './auth.js';
import { DEFAULT_CODEX_CLIENT_VERSION } from './constants.js';
import { createTransport, resolveProxyUrl } from './transport.js';

export const name = 'llm-codex';
export const inject = ['llm', 'attachments'];

/** The only provider route this plugin serves. */
export const PROVIDER = 'codex';

const NS = settingsNamespace('llm-codex-subscription');

const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;

const Config = z.object({
  clientVersion: z.string().default(DEFAULT_CODEX_CLIENT_VERSION),
  writeBack: z.boolean().default(true),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  proxy: z.string(),
  authFile: z.string(),
  account: z.string(),
  accounts: z.dict(z.string()),
  modelsCacheFile: z.string(),
  staticModels: z.array(
    z.object({
      id: z.string().required(),
      name: z.string(),
      contextWindow: z.number().min(1),
      maxTokens: z.number().min(1),
    }),
  ),
});

/** Resolve raw config, from a composer row or the settings section, into connection facts with safe defaults. */
function resolveOptions(raw) {
  const source = raw ?? {};
  const clientVersion =
    typeof source.clientVersion === 'string' && source.clientVersion.trim().length > 0
      ? source.clientVersion.trim()
      : DEFAULT_CODEX_CLIENT_VERSION;
  const streamIdleTimeoutMs =
    Number.isFinite(source.streamIdleTimeoutMs) && source.streamIdleTimeoutMs > 0
      ? source.streamIdleTimeoutMs
      : DEFAULT_STREAM_IDLE_TIMEOUT_MS;
  const accounts =
    source.accounts && typeof source.accounts === 'object' && !Array.isArray(source.accounts)
      ? Object.fromEntries(
          Object.entries(source.accounts).filter(
            ([name, file]) =>
              typeof name === 'string' && name.trim().length > 0 && typeof file === 'string' && file.trim().length > 0,
          ),
        )
      : undefined;
  const account = typeof source.account === 'string' && source.account.trim().length > 0 ? source.account.trim() : undefined;
  if (account !== undefined && accounts?.[account] === undefined) {
    throw new Error(`llm-codex-subscription: account "${account}" is not defined in accounts`);
  }
  return {
    clientVersion,
    writeBack: source.writeBack !== false,
    streamIdleTimeoutMs,
    proxy: typeof source.proxy === 'string' && source.proxy.trim().length > 0 ? source.proxy.trim() : undefined,
    authFile:
      account !== undefined ? accounts[account] : typeof source.authFile === 'string' && source.authFile.length > 0 ? source.authFile : undefined,
    account,
    accounts,
    modelsCacheFile:
      typeof source.modelsCacheFile === 'string' && source.modelsCacheFile.length > 0
        ? source.modelsCacheFile
        : undefined,
    staticModels:
      Array.isArray(source.staticModels) && source.staticModels.length > 0 ? source.staticModels : undefined,
  };
}

export function apply(ctx, config) {
  let current = () => config;
  let lastRaw;
  let lastGood;

  const options = () => {
    const raw = current();
    if (raw === lastRaw && lastGood !== undefined) return lastGood;
    try {
      const next = resolveOptions(raw);
      lastRaw = raw;
      lastGood = next;
      return next;
    } catch (error) {
      if (lastGood === undefined) throw error;
      ctx.logger?.error?.('llm-codex-subscription: invalid settings section, keeping the last valid config');
      ctx.logger?.error?.(error);
      return lastGood;
    }
  };

  // Evaluate once up front so invalid config fails loudly at load time
  options();

  // The transport is cached per proxy address and rebuilt when the proxy config changes
  let transportCache = { key: undefined, promise: undefined };
  const getTransport = () => {
    const key = resolveProxyUrl(options()) ?? '';
    if (transportCache.promise === undefined || transportCache.key !== key) {
      transportCache = { key, promise: createTransport(options()) };
    }
    return transportCache.promise;
  };

  const credentials = new CodexCredentials(() => ({
    ...options(),
    fetch: (url, init) => getTransport().then((transport) => transport.fetch(url, init)),
  }));
  const adapter = new CodexAdapter({ options, credentials, transport: getTransport, attachments: ctx.attachments });

  ctx.llm.registerConfigurableProviders([
    {
      provider: PROVIDER,
      displayName: 'Codex (ChatGPT subscription)',
      settingsNs: NS,
      settingsPath: [],
    },
  ]);

  const registration = ctx.llm.registerAdapter([PROVIDER], adapter);

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source;
    },
    onChange: () => {
      // Re-register the route when the settings section changes, keeping registration in step with config
      registration.replace([PROVIDER]);
    },
  });
}

const plugin = { name, inject, apply };
export default plugin;
