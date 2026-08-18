/**
 * Wire constants for the OpenAI Codex / ChatGPT subscription backend.
 *
 * Values match two implementations already verified against the backend:
 * - oh-my-pi-cn (https://github.com/yequ172672/oh-my-pi-cn) `packages/catalog/src/wire/codex.ts`
 * - opencodex (@bitkyc08/opencodex) `src/providers/openai-tiers.ts`
 */

/** Backend root for ChatGPT subscription credentials (Codex CLI login, `auth_mode: chatgpt`). */
export const CHATGPT_BASE_URL = 'https://chatgpt.com/backend-api';

/** Backend root for the official API key mode (`auth_mode: apikey`). */
export const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

/** ChatGPT OAuth token refresh endpoint (refresh_token grant). */
export const CODEX_OAUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token';

/** OAuth client id shared by the Codex CLI and ompcn. */
export const CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

/** Default codex CLI wire version, tracking @openai/codex releases; ompcn pins 0.144.1. */
export const DEFAULT_CODEX_CLIENT_VERSION = '0.144.1';

/** Request headers that matter in ChatGPT subscription mode. */
export const CODEX_HEADERS = {
  ACCOUNT_ID: 'chatgpt-account-id',
  BETA: 'OpenAI-Beta',
  ORIGINATOR: 'originator',
  VERSION: 'version',
  CONVERSATION_ID: 'conversation_id',
  SESSION_ID: 'session_id',
  REQUEST_ID: 'x-client-request-id',
};

export const CODEX_HEADER_VALUES = {
  BETA_RESPONSES: 'responses=experimental',
  ORIGINATOR: 'pi',
};

/** Default context window and max output, matching ompcn `discovery/codex.ts`. */
export const DEFAULT_CONTEXT_WINDOW = 272_000;
/** Real context for GPT-5.6 luna/sol/terra; the Codex catalog omits context_window for these SKUs. */
export const GPT_5_6_CONTEXT_WINDOW = 372_000;
export const DEFAULT_MAX_TOKENS = 128_000;
