/**
 * Translate the Responses API's SSE event stream into harness StreamChunks.
 *
 * Event vocabulary, identical between the ChatGPT subscription backend and the
 * official Responses API:
 * - response.output_item.added / .done
 * - response.output_text.delta / .done
 * - response.refusal.delta
 * - response.reasoning_summary_text.delta / .done
 * - response.function_call_arguments.delta / .done
 * - response.completed / response.done / response.incomplete / response.failed
 * - response.usage / error
 *
 * Block rules: reasoning, body text, and tool calls each get their own block.
 * A block opens lazily on its first delta and closes at output_item.done or at
 * a terminal event. usage and finish are always emitted last.
 */

import { CallId, LlmError, EMPTY_RESPONSE_CODE } from '@deepseek-ai/dsh-llm';

/** Fold wire usage into the harness's disjoint TokenUsage, splitting cached out of input. */
export function mapUsage(usage) {
  if (!usage || typeof usage !== 'object') return undefined;
  const cached = usage.input_tokens_details?.cached_tokens;
  const reasoning = usage.output_tokens_details?.reasoning_tokens;
  return {
    inputTokens: (usage.input_tokens ?? 0) - (typeof cached === 'number' ? cached : 0),
    outputTokens: usage.output_tokens ?? 0,
    ...(typeof cached === 'number' ? { cacheReadTokens: cached } : {}),
    ...(typeof reasoning === 'number' ? { reasoningTokens: reasoning } : {}),
  };
}

/** Close a block, assembling the final ContentBlock. */
function closeBlock(block) {
  switch (block.kind) {
    case 'reasoning':
      return { type: 'reasoning', text: block.text };
    case 'tool-call':
      return { type: 'tool-call', id: CallId(block.callId ?? ''), name: block.name ?? '', arguments: block.text };
    case 'text':
    default:
      return { type: 'text', text: block.text };
  }
}

/** Extract a function_call's call_id and name from an output item. */
function functionCallMeta(item) {
  if (!item || typeof item !== 'object') return { callId: undefined, name: undefined };
  return {
    callId: typeof item.call_id === 'string' ? item.call_id : undefined,
    name: typeof item.name === 'string' ? item.name : undefined,
  };
}

/**
 * Consume SSE data payloads and yield StreamChunks.
 * @param payloads - JSON payloads from parseSse; the stream just ends, with no [DONE].
 */
export async function* translate(payloads) {
  let nextIndex = 0;
  const blocks = new Map(); // key -> block;key = item_id(function_call) | "reasoning:"+item_id | "text:"+item_id
  const order = [];
  let pendingUsage;
  let lastKind; // kind of the most recently closed block (text/reasoning/tool-call)

  const openBlock = (kind, callId, name) => {
    const block = { index: nextIndex++, kind, text: '', callId, name };
    order.push(block);
    return block;
  };

  /** Get the block for a key, lazily opening it and emitting block-start first. */
  const ensureBlock = function* (key, kind, callId, name) {
    let block = blocks.get(key);
    if (!block) {
      block = openBlock(kind, callId, name);
      blocks.set(key, block);
      yield { type: 'block-start', index: block.index, blockType: kind };
    }
    return block;
  };

  /** Close the blocks for the given keys, emitting a block-end for each. */
  const closeBlocks = function* (keys) {
    for (const key of keys) {
      const block = blocks.get(key);
      if (!block) continue;
      blocks.delete(key);
      lastKind = block.kind;
      yield { type: 'block-end', index: block.index, block: closeBlock(block) };
    }
  };

  /** Termination sequence, in fixed order: close every remaining block -> usage -> finish. */
  const finish = function* (reason) {
    yield* closeBlocks([...blocks.keys()]);
    if (pendingUsage !== undefined) yield { type: 'usage', usage: pendingUsage };
    if (reason.kind === 'stop' && order.length === 0) {
      yield {
        type: 'finish',
        reason: {
          kind: 'error',
          failure: { message: 'model returned a completed response with no content', code: EMPTY_RESPONSE_CODE },
        },
      };
    } else {
      yield { type: 'finish', reason };
    }
  };

  for await (const payload of payloads) {
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      throw new LlmError(`malformed SSE payload: ${payload.slice(0, 120)}`, 'MALFORMED_RESPONSE');
    }
    switch (event.type) {
      case 'response.output_item.added': {
        const item = event.item;
        if (!item || typeof item !== 'object') break;
        if (item.type === 'function_call') {
          // A tool call opens its block when the item appears, since call_id/name are known; arguments arrive as deltas
          const { callId, name } = functionCallMeta(item);
          yield* ensureBlock(item.id, 'tool-call', callId, name);
        }
        // A message item does not open here: it waits for its first delta, avoiding empty blocks
        break;
      }

      case 'response.output_text.delta':
      case 'response.refusal.delta': {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        if (delta.length === 0) break;
        const key = `text:${event.item_id}`;
        yield* ensureBlock(key, 'text');
        const block = blocks.get(key);
        block.text += delta;
        yield { type: 'text-delta', index: block.index, text: delta };
        break;
      }

      case 'response.reasoning_summary_text.delta': {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        if (delta.length === 0) break;
        const key = `reasoning:${event.item_id}`;
        yield* ensureBlock(key, 'reasoning');
        const block = blocks.get(key);
        block.text += delta;
        yield { type: 'reasoning-delta', index: block.index, text: delta };
        break;
      }

      case 'response.function_call_arguments.delta': {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        const key = event.item_id;
        yield* ensureBlock(key, 'tool-call');
        const block = blocks.get(key);
        block.text += delta;
        yield {
          type: 'tool-call-delta',
          index: block.index,
          id: CallId(block.callId ?? ''),
          ...(block.name !== undefined ? { name: block.name } : {}),
          argumentsDelta: delta,
        };
        break;
      }

      case 'response.output_item.done': {
        const item = event.item;
        if (!item || typeof item !== 'object') break;
        if (item.type === 'function_call') {
          const { callId, name } = functionCallMeta(item);
          const block = blocks.get(item.id);
          if (!block) {
            // Edge case: a complete tool call with no deltas at all -> open the block and close it immediately
            yield* ensureBlock(item.id, 'tool-call', callId, name);
            const opened = blocks.get(item.id);
            if (typeof item.arguments === 'string') opened.text = item.arguments;
          } else {
            if (block.callId === undefined && callId !== undefined) block.callId = callId;
            if (block.name === undefined && name !== undefined) block.name = name;
          }
          yield* closeBlocks([item.id]);
        } else if (item.type === 'message') {
          yield* closeBlocks([`reasoning:${item.id}`, `text:${item.id}`]);
        }
        break;
      }

      case 'response.usage': {
        const mapped = mapUsage(event.usage);
        if (mapped !== undefined) pendingUsage = mapped;
        break;
      }

      case 'response.completed':
      case 'response.done': {
        const mapped = mapUsage(event.usage ?? event.response?.usage);
        if (mapped !== undefined) pendingUsage = mapped;
        yield* finish({ kind: lastKind === 'tool-call' ? 'tool-calls' : 'stop' });
        return;
      }

      case 'response.incomplete': {
        const reason = typeof event.reason === 'string' ? event.reason : undefined;
        yield* finish(
          reason === 'max_output_tokens'
            ? { kind: 'max-tokens' }
            : {
                kind: 'error',
                failure: { message: `response incomplete: ${reason ?? 'unknown'}`, code: 'INCOMPLETE' },
              },
        );
        return;
      }

      case 'response.failed': {
        throw new LlmError(
          event.error?.message ?? 'response failed',
          'PROVIDER',
          typeof event.error?.status === 'number' ? { status: event.error.status } : {},
        );
      }

      case 'error': {
        throw new LlmError(
          typeof event.message === 'string' ? event.message : 'provider error',
          'PROVIDER',
          typeof event.status === 'number' ? { status: event.status } : {},
        );
      }

      default:
        break; // ignore response.created, content_part.*, output_text.done, and friends
    }
  }

  throw new LlmError('SSE stream ended without a terminal response event', 'STREAM_CLOSED');
}
