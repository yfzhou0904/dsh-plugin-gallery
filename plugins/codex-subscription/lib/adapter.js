/**
 * CodexAdapter: an LLM adapter that reuses the Codex CLI's local credentials.
 *
 * The transport is structured like dsh-llm-deepseek's: fetch + SSE -> harness
 * StreamChunk. Credentials are resolved per request, so auth.json is followed
 * live, and a 401 refreshes the subscription token and retries once.
 */

import {
  LlmAdapter,
  LlmError,
  ProviderRequestId,
  ReasoningEffortId,
  attributionHeaders,
} from '@deepseek-ai/dsh-llm';
import { idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout';

import { CODEX_HEADERS, CODEX_HEADER_VALUES, DEFAULT_CODEX_CLIENT_VERSION, DEFAULT_MAX_TOKENS } from './constants.js';
import { buildCatalog, reasoningInfo } from './models.js';
import { serializeRequest } from './serialize.js';
import { parseSse } from './sse.js';
import { createTransport } from './transport.js';
import { translate } from './translate.js';

const STREAM_IDLE_TIMEOUT_CODE = 'LLM_STREAM_IDLE_TIMEOUT';
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;
const DEFAULT_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

function providerRetryAfterMs(value) {
  if (value === null) return undefined;
  if (/^\d+$/.test(value)) {
    const delay = Number(value) * 1000;
    return Number.isFinite(delay) && delay > 0 ? delay : undefined;
  }
  const delay = Date.parse(value) - Date.now();
  return Number.isFinite(delay) && delay > 0 ? delay : undefined;
}

function requestId(headers) {
  const value = headers.get('x-request-id') ?? headers.get('x-req-id');
  return value === null || value.length === 0 ? undefined : ProviderRequestId(value);
}

/** Map an HTTP status to a stable error code, using the same taxonomy as dsh-llm-deepseek. */
function httpErrorCode(status, error) {
  if (status === 401 || status === 403) return 'AUTH';
  const detail = [error?.code, error?.type, error?.message].filter(Boolean).join(' ');
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400) return 'INVALID_REQUEST';
  if (status >= 500) return 'SERVER';
  return `HTTP_${status}`;
}

export class CodexAdapter extends LlmAdapter {
  /**
   * @param options - `() => resolved config`, re-evaluated per request so
   *   hot-reloaded settings take effect.
   * @param credentials - A CodexCredentials instance.
   * @param transport - `() => Promise<{ fetch, toWebStream }>`, the transport
   *   factory that adds proxy support. Built from options by default, which is
   *   equally aware of the proxy config.
   * @param fetchImpl - An injectable fetch for tests, overriding transport.
   */
  constructor({ options, credentials, transport, fetchImpl, attachments }) {
    super();
    this.options = options;
    this.credentials = credentials;
    this.attachments = attachments;
    this.transport =
      typeof transport === 'function' ? transport : async () => createTransport(this.options());
    this.fetchImpl = typeof fetchImpl === 'function' ? fetchImpl : undefined;
  }

  providerInfo(provider) {
    return { id: provider, name: 'Codex (ChatGPT subscription)' };
  }

  providerRetryPolicy() {
    return undefined; // use the harness's default retry policy
  }

  async listModels(provider) {
    const config = this.options();
    const creds = await this.credentials.current();
    const transport = await this.transport();
    const catalog = await buildCatalog(creds, config, undefined, transport);
    return catalog.map((entry) => ({
      provider,
      id: entry.id,
      name: entry.name,
      inputModalities: ['text', 'image'],
    }));
  }

  async resolveModel(provider, model, signal) {
    const config = this.options();
    const creds = await this.credentials.current();
    const transport = await this.transport();
    const catalog = await buildCatalog(creds, config, signal, transport);
    const entry = catalog.find((item) => item.id === model);
    return {
      provider,
      id: model,
      name: entry?.name ?? model,
      inputModalities: ['text', 'image'],
      context: { contextWindow: entry?.contextWindow ?? 272_000 },
      // The ChatGPT subscription backend rejects max_output_tokens (HTTP 400
      // "Unsupported parameter"), so subscription mode does not materialize an
      // output cap and takes the backend default; only API key mode sets one.
      ...(creds.mode === 'apikey'
        ? { defaultMaxTokens: entry?.maxTokens ?? config.maxTokens ?? DEFAULT_MAX_TOKENS }
        : {}),
      reasoning: reasoningInfo(entry ?? {
        id: model,
        name: model,
        contextWindow: 272_000,
        maxTokens: DEFAULT_MAX_TOKENS,
        defaultEffort: 'medium',
        efforts: DEFAULT_REASONING_EFFORTS,
      }),
    };
  }

  async *stream(options) {
    const config = this.options();
    const consumer = new AbortController();
    let watchdog;
    try {
      watchdog = idleWatchdog(
        options.signal === undefined ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]),
        config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS,
        STREAM_IDLE_TIMEOUT_CODE,
      );
    } catch (error) {
      consumer.abort();
      throw error;
    }
    const iterator = this.request(options, watchdog.signal, () => watchdog.pulse())[Symbol.asyncIterator]();
    let exhausted = false;
    try {
      while (true) {
        const result = await watchdog.next(iterator);
        if (result.done) {
          exhausted = true;
          return;
        }
        yield result.value;
      }
    } catch (error) {
      if (timeoutOf(watchdog.signal, STREAM_IDLE_TIMEOUT_CODE) !== undefined) {
        throw new LlmError(
          `Codex stream idle timeout after ${config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS}ms`,
          'TIMEOUT',
          { cause: error },
        );
      }
      if (options.signal?.aborted) {
        throw new LlmError('Codex request aborted by caller', 'ABORTED', { cause: error });
      }
      if (error instanceof LlmError) throw error;
      throw new LlmError('Codex API stream failed', 'TRANSPORT', { cause: error });
    } finally {
      consumer.abort('Codex stream consumer stopped');
      if (!exhausted && iterator.return !== undefined) {
        try {
          await iterator.return();
        } catch {
          // a failed transport cleanup is safe to ignore
        }
      }
      try {
        watchdog[Symbol.dispose]?.();
      } catch {
        // a failed timer cleanup is safe to ignore
      }
    }
  }

  async *request(options, signal, onComment) {
    const config = this.options();
    const body = await serializeRequest(options, this.attachments);
    let retried = false;

    while (true) {
      const creds = await this.credentials.current();
      // The ChatGPT subscription backend implements only a subset of the
      // Responses protocol and rejects these standard fields with HTTP 400
      // "Unsupported parameter: ...": max_output_tokens, temperature, stop.
      // Subscription mode strips them all and takes the backend defaults;
      // official API key mode is unaffected.
      if (creds.mode === 'chatgpt') {
        delete body.max_output_tokens;
        delete body.temperature;
        delete body.stop;
      }
      const payload = JSON.stringify(body);
      const headers = {
        authorization: `Bearer ${creds.mode === 'apikey' ? creds.apiKey : creds.accessToken}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
        ...attributionHeaders(),
      };

      let url;
      if (creds.mode === 'apikey') {
        url = `${creds.baseURL}/responses`;
      } else {
        headers[CODEX_HEADERS.BETA] = CODEX_HEADER_VALUES.BETA_RESPONSES;
        headers[CODEX_HEADERS.ORIGINATOR] = CODEX_HEADER_VALUES.ORIGINATOR;
        headers[CODEX_HEADERS.VERSION] = config.clientVersion ?? DEFAULT_CODEX_CLIENT_VERSION;
        if (creds.accountId) headers[CODEX_HEADERS.ACCOUNT_ID] = creds.accountId;
        if (options.sessionId !== undefined) {
          const sid = String(options.sessionId);
          headers[CODEX_HEADERS.CONVERSATION_ID] = sid;
          headers[CODEX_HEADERS.SESSION_ID] = sid;
          headers[CODEX_HEADERS.REQUEST_ID] = sid;
        }
        url = `${creds.baseURL}/codex/responses`;
      }

      let response;
      try {
        const transport = await this.transport();
        const doFetch = this.fetchImpl ?? transport.fetch;
        response = await doFetch(url, { method: 'POST', headers, body: payload, signal });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new LlmError(`The Codex API request to ${url} failed`, 'TRANSPORT', { cause: error });
      }

      if (!response.ok) {
        let message = `Codex API error (HTTP ${response.status})`;
        let providerError;
        try {
          const json = await response.json();
          providerError = json?.error ?? json;
          if (typeof providerError?.message === 'string' && providerError.message.length > 0) {
            message = providerError.message;
          } else if (typeof providerError?.detail === 'string' && providerError.detail.length > 0) {
            message = providerError.detail;
          }
        } catch {
          // keep the default message
        }
        const delay = providerRetryAfterMs(response.headers.get('retry-after'));
        const id = requestId(response.headers);

        if (response.status === 401 && creds.mode === 'chatgpt' && !retried) {
          retried = true;
          await this.credentials.refresh(); // a failed refresh throws AUTH
          continue;
        }

        throw new LlmError(message, httpErrorCode(response.status, providerError), {
          status: response.status,
          ...(delay === undefined ? {} : { providerRetryAfterMs: delay }),
          ...(id === undefined ? {} : { requestId: id }),
        });
      }

      if (!response.body) throw new LlmError('The Codex API returned an empty response body', 'EMPTY_RESPONSE');
      yield* translate(parseSse(response.body, onComment));
      return;
    }
  }
}
