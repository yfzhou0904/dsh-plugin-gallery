import { Buffer } from 'node:buffer';
import { LlmError } from '@deepseek-ai/dsh-llm';

function flattenText(blocks) {
  return blocks.filter((block) => block.type === 'text').map((block) => block.text).join('');
}

async function contentParts(blocks, attachments) {
  const parts = [];
  for (const block of blocks) {
    if (block.type === 'text') parts.push({ type: 'input_text', text: block.text });
    else if (block.type === 'image') {
      if (attachments === undefined) throw new LlmError('Image input requires the DSH attachment service.', 'UNSUPPORTED_CONTENT');
      const stored = await attachments.readImage(block.attachment);
      parts.push({ type: 'input_image', image_url: `data:${stored.ref.mediaType};base64,${Buffer.from(stored.data).toString('base64')}` });
    }
  }
  return parts;
}

async function serializeMessages(messages, systemParts, attachments) {
  const input = [];
  for (const message of messages) {
    if (message.role === 'system') {
      const text = flattenText(message.content);
      if (text.length > 0) systemParts.push(text);
      continue;
    }
    if (message.role === 'assistant') {
      const text = flattenText(message.content);
      if (text.length > 0) input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });
      for (const block of message.content) if (block.type === 'tool-call') input.push({ type: 'function_call', call_id: block.id, name: block.name, arguments: block.arguments });
      continue;
    }
    const content = await contentParts(message.content, attachments);
    if (content.length > 0) input.push({ type: 'message', role: 'user', content });
    for (const block of message.content) if (block.type === 'tool-result') input.push({ type: 'function_call_output', call_id: block.toolCallId, output: flattenText(block.content) || '(no output)' });
  }
  return input;
}

const WIRE_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
export function wireEffort(effort) {
  if (effort === undefined || effort === null) return undefined;
  const value = String(effort).toLowerCase();
  if (value === 'off' || value === 'none' || value === 'disabled') return undefined;
  return WIRE_EFFORTS.has(value) ? value : undefined;
}

export async function serializeRequest(options, attachments) {
  const systemParts = [];
  if (typeof options.system === 'string' && options.system.length > 0) systemParts.push(options.system);
  const input = await serializeMessages(options.messages, systemParts, attachments);
  const tools = options.tools?.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters }));
  const effort = wireEffort(options.reasoningEffort);
  return {
    model: options.model, input, stream: true, store: false,
    ...(systemParts.length > 0 ? { instructions: systemParts.join('\n\n') } : {}),
    ...(tools !== undefined && tools.length > 0 ? { tools } : {}),
    ...(effort !== undefined ? { reasoning: { effort } } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens === undefined ? {} : { max_output_tokens: options.maxTokens }),
    ...(options.stop !== undefined && options.stop.length > 0 ? { stop: options.stop } : {}),
  };
}
