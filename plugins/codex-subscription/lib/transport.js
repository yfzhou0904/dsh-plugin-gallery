/**
 * Transport layer: optional HTTP CONNECT proxy (Clash and friends).
 *
 * Background: Node's native fetch (undici) does not read system proxy settings
 * or proxy environment variables, while the ChatGPT backend usually has to go
 * through a local proxy. node-fetch and https-proxy-agent are already in the
 * deployment dependency tree, so this module combines them: requests go through
 * a CONNECT tunnel when a proxy is configured, and through native fetch
 * otherwise.
 *
 * Proxy resolution order: explicit `proxy` config > HTTPS_PROXY/https_proxy >
 * HTTP_PROXY/http_proxy; hosts matching NO_PROXY connect directly.
 */

import { Readable } from 'node:stream';

import { LlmError } from '@deepseek-ai/dsh-llm';

/** Resolve the effective proxy address; undefined when there is no proxy. */
export function resolveProxyUrl(config) {
  const explicit =
    typeof config?.proxy === 'string' && config.proxy.trim().length > 0 ? config.proxy.trim() : undefined;
  const envProxy =
    explicit ??
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (typeof envProxy !== 'string' || envProxy.trim().length === 0) return undefined;
  return envProxy.trim();
}

/** NO_PROXY matching: comma-separated entries, supporting an exact host and *.suffix. */
export function shouldBypassProxy(hostname, noProxyValue) {
  if (typeof noProxyValue !== 'string' || noProxyValue.trim().length === 0) return false;
  const host = String(hostname ?? '').toLowerCase();
  for (const raw of noProxyValue.split(',')) {
    const entry = raw.trim().toLowerCase();
    if (entry.length === 0) continue;
    if (entry === host) return true;
    if (entry.startsWith('*') && host.endsWith(entry.slice(1))) return true;
    if (entry.startsWith('.') && host.endsWith(entry)) return true;
  }
  return false;
}

/** Normalize a fetch response body to a Web ReadableStream; node-fetch bodies are Node Readables. */
export function toWebStream(body) {
  if (body === undefined || body === null) return body;
  if (typeof body.pipeThrough === 'function') return body; // native fetch: already a Web ReadableStream
  return Readable.toWeb(body); // node-fetch: Node Readable -> Web ReadableStream
}

/** Build the transport object { fetch, toWebStream } from config. */
export async function createTransport(config) {
  const proxyUrl = resolveProxyUrl(config);
  if (proxyUrl === undefined) {
    return { fetch, toWebStream };
  }
  try {
    const proxyMod = await import('https-proxy-agent');
    const HttpsProxyAgent = proxyMod.HttpsProxyAgent ?? proxyMod.default?.HttpsProxyAgent;
    const { default: nodeFetch } = await import('node-fetch');
    if (typeof HttpsProxyAgent !== 'function' || typeof nodeFetch !== 'function') {
      throw new Error('unexpected module shape');
    }
    const agent = new HttpsProxyAgent(proxyUrl);
    const proxyFetch = (url, init = {}) => {
      const target = typeof url === 'string' ? new URL(url) : url;
      if (shouldBypassProxy(target.hostname, process.env.NO_PROXY ?? process.env.no_proxy)) {
        return fetch(url, init);
      }
      return nodeFetch(url, { ...init, agent });
    };
    return { fetch: proxyFetch, toWebStream };
  } catch (error) {
    throw new LlmError(
      `Proxy ${proxyUrl} is configured, but loading https-proxy-agent / node-fetch failed: ${error?.message ?? error}`,
      'TRANSPORT',
      { cause: error },
    );
  }
}
