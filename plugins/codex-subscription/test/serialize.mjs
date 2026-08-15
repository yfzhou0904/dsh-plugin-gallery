import assert from 'node:assert/strict';
import { serializeRequest } from '../lib/serialize.js';

const request = await serializeRequest({
  model: 'gpt-5.6-luna',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'What is this?' }, { type: 'image', attachment: { attachmentId: 'sha256:test', mediaType: 'image/png' } }] }],
}, { readImage: async () => ({ ref: { mediaType: 'image/png' }, data: new Uint8Array([137, 80, 78, 71]) }) });

assert.deepEqual(request.input[0].content, [
  { type: 'input_text', text: 'What is this?' },
  { type: 'input_image', image_url: 'data:image/png;base64,iVBORw==' },
]);
console.log('multimodal serialization ok');
