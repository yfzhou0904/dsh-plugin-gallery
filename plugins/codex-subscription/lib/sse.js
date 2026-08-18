/**
 * SSE parsing: split the response byte stream into data payloads.
 *
 * Unlike chat-completions, the Responses protocol has no [DONE] sentinel — the
 * end of a stream is expressed by events such as `response.completed` and
 * `response.incomplete`. So this module only yields data payloads one by one,
 * neither expecting nor producing a sentinel.
 */

import { EventSourceParserStream } from 'eventsource-parser/stream';

import { toWebStream } from './transport.js';

/** Parse an SSE byte stream into data payloads, skipping blank lines and comments. Returns when the stream ends. */
export async function* parseSse(stream, onComment) {
  const web = toWebStream(stream); // node-fetch hands back a Node Readable; normalize to a Web ReadableStream
  const events = web
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream({ onComment }));
  for await (const { data } of events) {
    const trimmed = data.trim();
    if (trimmed.length > 0) yield trimmed;
  }
}
