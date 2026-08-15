/**
 * 传输层:可选 HTTP CONNECT 代理(Clash 等)。
 *
 * 背景:Node 的原生 fetch(undici)不读取系统代理/代理环境变量,而 ChatGPT
 * 后端通常需要走本地代理。部署依赖树中已有 node-fetch + https-proxy-agent,
 * 这里组合它们:配置了代理时经 CONNECT 隧道转发,否则直接用原生 fetch。
 *
 * 代理解析优先级:显式配置 proxy > HTTPS_PROXY/https_proxy > HTTP_PROXY/http_proxy;
 * NO_PROXY 命中的主机直连。
 */

import { Readable } from 'node:stream';

import { LlmError } from '@deepseek-ai/dsh-llm';

/** 解析生效的代理地址;无代理返回 undefined。 */
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

/** NO_PROXY 判定:逗号分隔条目,支持精确 host 与 *.suffix。 */
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

/** 把 fetch 响应体统一为 Web ReadableStream(node-fetch 的 body 是 Node Readable)。 */
export function toWebStream(body) {
  if (body === undefined || body === null) return body;
  if (typeof body.pipeThrough === 'function') return body; // 原生 fetch:已是 Web ReadableStream
  return Readable.toWeb(body); // node-fetch:Node Readable → Web ReadableStream
}

/** 根据配置构造传输对象 { fetch, toWebStream }。 */
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
      `已配置代理 ${proxyUrl},但加载 https-proxy-agent / node-fetch 失败:${error?.message ?? error}`,
      'TRANSPORT',
      { cause: error },
    );
  }
}
