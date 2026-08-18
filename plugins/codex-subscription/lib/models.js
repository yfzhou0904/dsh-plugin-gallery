/**
 * Model catalog: fetched live from the ChatGPT backend's /codex/models, falling
 * back on failure to `~/.codex/models_cache.json` (the codex CLI/desktop cache)
 * and then to a built-in static list.
 */

import { readFile } from 'node:fs/promises';

import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';

import {
  CODEX_HEADERS,
  CODEX_HEADER_VALUES,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  GPT_5_6_CONTEXT_WINDOW,
} from './constants.js';

const DEFAULT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

/** Built-in fallback catalog, tracking the user's models_cache.json and codex release cadence. */
export const STATIC_MODELS = [
  { id: 'gpt-5.6-sol', name: 'GPT-5.6-Sol' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6-Luna' },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6-Terra' },
  { id: 'gpt-5.5', name: 'GPT-5.5' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4-Mini' },
  { id: 'gpt-5.2-codex-mini', name: 'GPT-5.2-Codex-Mini' },
  { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1-Codex-Mini' },
  { id: 'o4-mini', name: 'O4-Mini' },
];

/** Hard-coded context for GPT-5.6 luna/sol/terra; every other model uses the generic window. */
export function contextWindowFor(modelId) {
  return /^gpt-5\.6/.test(modelId ?? '') ? GPT_5_6_CONTEXT_WINDOW : DEFAULT_CONTEXT_WINDOW;
}

/** Read ~/.codex/models_cache.json, the latest catalog Codex has cached. */
export async function readModelsCacheFile(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(raw);
    const entries = Array.isArray(data.models) ? data.models : Array.isArray(data.data) ? data.data : [];
    const out = [];
    for (const entry of entries) {
      const id = typeof entry?.slug === 'string' ? entry.slug : entry?.id;
      if (typeof id !== 'string' || id.length === 0) continue;
      const visibility = typeof entry?.visibility === 'string' ? entry.visibility.toLowerCase() : undefined;
      if (visibility === 'hide' || visibility === 'hidden') continue;
      out.push({
        id,
        name: typeof entry?.display_name === 'string' && entry.display_name.length > 0 ? entry.display_name : id,
        contextWindow:
          typeof entry?.context_window === 'number' && entry.context_window > 0 ? entry.context_window : undefined,
        defaultEffort:
          typeof entry?.default_reasoning_level === 'string' && entry.default_reasoning_level.length > 0
            ? entry.default_reasoning_level
            : undefined,
        efforts: Array.isArray(entry?.supported_reasoning_levels)
          ? entry.supported_reasoning_levels
              .map((item) => (typeof item === 'string' ? item : item?.effort))
              .filter((item) => typeof item === 'string' && item.length > 0)
          : undefined,
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Fetch the live catalog from the ChatGPT backend (GET {base}/codex/models). Returns null on any failure. */
export async function discoverModelsLive(creds, clientVersion, signal, transport) {
  try {
    const url = new URL(`${creds.baseURL}/codex/models`);
    url.searchParams.set('client_version', clientVersion);
    const headers = {
      authorization: `Bearer ${creds.mode === 'apikey' ? creds.apiKey : creds.accessToken}`,
      accept: 'application/json',
    };
    if (creds.mode === 'chatgpt') {
      headers[CODEX_HEADERS.BETA] = CODEX_HEADER_VALUES.BETA_RESPONSES;
      headers[CODEX_HEADERS.ORIGINATOR] = CODEX_HEADER_VALUES.ORIGINATOR;
      headers[CODEX_HEADERS.VERSION] = clientVersion;
      if (creds.accountId) headers[CODEX_HEADERS.ACCOUNT_ID] = creds.accountId;
    }
    const response = await transport.fetch(url, { method: 'GET', headers, signal });
    if (!response.ok) return null;
    const data = await response.json();
    const entries = Array.isArray(data.models) ? data.models : Array.isArray(data.data) ? data.data : [];
    const out = [];
    for (const entry of entries) {
      const id = typeof entry?.slug === 'string' ? entry.slug : entry?.id;
      if (typeof id !== 'string' || id.length === 0) continue;
      const visibility = typeof entry?.visibility === 'string' ? entry.visibility.toLowerCase() : undefined;
      if (visibility === 'hide' || visibility === 'hidden') continue;
      out.push({
        id,
        name: typeof entry?.display_name === 'string' && entry.display_name.length > 0 ? entry.display_name : id,
        contextWindow:
          typeof entry?.context_window === 'number' && entry.context_window > 0 ? entry.context_window : undefined,
        defaultEffort:
          typeof entry?.default_reasoning_level === 'string' && entry.default_reasoning_level.length > 0
            ? entry.default_reasoning_level
            : undefined,
        efforts: Array.isArray(entry?.supported_reasoning_levels)
          ? entry.supported_reasoning_levels
              .map((item) => (typeof item === 'string' ? item : item?.effort))
              .filter((item) => typeof item === 'string' && item.length > 0)
          : undefined,
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Fill in defaults on a catalog entry: context, output cap, reasoning levels. */
export function completeEntry(entry) {
  const contextWindow = entry.contextWindow ?? contextWindowFor(entry.id);
  const maxTokens = Math.min(entry.maxTokens ?? DEFAULT_MAX_TOKENS, contextWindow);
  return {
    id: entry.id,
    name: entry.name ?? entry.id,
    contextWindow,
    maxTokens,
    defaultEffort: entry.defaultEffort ?? 'medium',
    efforts: Array.isArray(entry.efforts) && entry.efforts.length > 0 ? entry.efforts : DEFAULT_EFFORTS,
  };
}

/**
 * Assemble the final catalog. Precedence: explicit staticModels config > live
 * discovery > models_cache.json > built-in list.
 * @returns The full list of entries, deduplicated.
 */
export async function buildCatalog(creds, config, signal, transport) {
  let entries = null;

  if (Array.isArray(config.staticModels) && config.staticModels.length > 0) {
    entries = config.staticModels.map((entry) => ({
      id: entry.id,
      name: entry.name ?? entry.id,
      contextWindow: entry.contextWindow,
      maxTokens: entry.maxTokens,
    }));
  } else {
    const liveSignal = signal ?? AbortSignal.timeout(10_000);
    entries = await discoverModelsLive(creds, config.clientVersion, liveSignal, transport);
    if (entries === null) {
      entries = await readModelsCacheFile(config.modelsCacheFile);
    }
    if (entries === null) {
      entries = STATIC_MODELS;
    }
  }

  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(completeEntry(entry));
  }
  return out;
}

/** Reasoning-level display metadata for the adapter. */
export function reasoningInfo(entry) {
  return {
    efforts: entry.efforts.map((effort) => ({ id: ReasoningEffortId(effort), name: effort })),
    defaultEffort: ReasoningEffortId(entry.defaultEffort),
  };
}
