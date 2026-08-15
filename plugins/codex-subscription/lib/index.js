/**
 * dsh-llm-codex-subscription:在 DSH 中注册 `codex` LLM provider,复用 Codex CLI 本地
 * 登录凭证(~/.codex/auth.json),让 ChatGPT 订阅模型(gpt-5.6-sol 等)直接
 * 出现在 DSH 的模型选择器里。
 *
 * 组成方式(与 @deepseek-ai/dsh-llm-deepseek 同构):
 *   - id: llm-codex
 *     name: dsh-llm-codex
 *
 * 可选配置(composer 行 config 或 settings.yaml 的 `llm-codex-subscription:` 段,热更新):
 *   - clientVersion: codex wire 版本(默认 0.144.1)
 *   - writeBack:     刷新订阅令牌后是否写回 auth.json(默认 true)
 *   - authFile:      覆盖 auth.json 路径
 *   - account:       选择账户别名(从 accounts 映射解析)
 *   - accounts:      账户别名到 auth.json 路径的映射
 *   - modelsCacheFile: 覆盖 models_cache.json 路径
 *   - staticModels:  显式模型目录(覆盖自动发现)
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

/** 本插件唯一的 provider 路由。 */
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

/** 把原始配置(composer 行或设置段)解析为安全默认值填充的连接事实。 */
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
      ctx.logger?.error?.('llm-codex-subscription: 设置段无效,保留最后一次有效配置');
      ctx.logger?.error?.(error);
      return lastGood;
    }
  };

  // 先求值一次:配置非法时在装载期立刻失败(loud fail)
  options();

  // 传输对象按代理地址缓存;代理配置变化时自动重建
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
      displayName: 'Codex (ChatGPT 订阅)',
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
      // 设置段变化后重注册路由,保持注册事实与配置一致
      registration.replace([PROVIDER]);
    },
  });
}

const plugin = { name, inject, apply };
export default plugin;
