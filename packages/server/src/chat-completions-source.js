import {readJsonStream, STREAM_DONE, abortableBytes} from './stream-transport.js';

export function createChatCompletionsSource({endpoint, apiKey, model, fetchImpl = fetch, timeoutMs = 60000,
  maxOutputTokens = 8192, maxOutputChars = 30000, includeUsage = true, tokenParameter = 'max_completion_tokens',
  instructions = 'Answer in ordinary text. Preserve qualifications and distinguish illustrative data. Do not claim to perform external actions.'} = {}) {
  const url = new URL(endpoint);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) throw TypeError('Invalid server-configured chat endpoint');
  if (typeof model !== 'string' || !model.trim() || model.length > 200 || typeof instructions !== 'string' || instructions.length > 30000) throw TypeError('Explicit model and valid instructions required');
  if (apiKey !== undefined && (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/.test(apiKey))) throw TypeError('Invalid source credential');
  if (![timeoutMs, maxOutputTokens, maxOutputChars].every(value => Number.isSafeInteger(value) && value > 0) || timeoutMs > 2147483647 || typeof includeUsage !== 'boolean' || !['max_completion_tokens', 'max_tokens'].includes(tokenParameter)) throw TypeError('Invalid source limits');
  return {async *generate({text, history = [], signal, onUsage = () => {}}) {
    if (typeof text !== 'string' || !Array.isArray(history) || history.length > 16 || history.some(item => !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string')) throw TypeError('Invalid source input');
    const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    let usage = null, finished = false, terminal = false, id, characters = 0;
    try {
      combined.throwIfAborted();
      const response = await fetchImpl(url.href, {method: 'POST', redirect: 'error', signal: combined,
        headers: {'Content-Type': 'application/json', ...(apiKey ? {Authorization: `Bearer ${apiKey}`} : {})},
        body: JSON.stringify({model, messages: [{role: 'system', content: instructions}, ...history.map(({role, content}) => ({role, content})), {role: 'user', content: text}],
          stream: true, n: 1, [tokenParameter]: maxOutputTokens, ...(includeUsage ? {stream_options: {include_usage: true}} : {})})});
      if (!response.ok || !response.body) {void response.body?.cancel().catch(() => {}); throw Error('Source unavailable');}
      for await (const event of readJsonStream(abortableBytes(response.body, combined), 'sse', {includeDone: true})) {
        combined.throwIfAborted();
        if (event === STREAM_DONE) {if (!finished) throw Error('Premature terminal marker'); terminal = true; break;}
        if (!event || event.error || event.object !== 'chat.completion.chunk' || typeof event.id !== 'string' || !Array.isArray(event.choices)) throw Error('Invalid chat chunk');
        id ??= event.id; if (event.id !== id) throw Error('Changed response identity');
        if (event.usage != null) {
          if (usage || !Number.isSafeInteger(event.usage.prompt_tokens) || !Number.isSafeInteger(event.usage.completion_tokens) || event.usage.prompt_tokens < 0 || event.usage.completion_tokens < 0) throw Error('Invalid usage');
          usage = {input_tokens: event.usage.prompt_tokens, output_tokens: event.usage.completion_tokens};
        }
        if (!event.choices.length) continue;
        if (event.choices.length !== 1 || event.choices[0].index !== 0 || finished) throw Error('Unexpected choice');
        const {delta, finish_reason: reason} = event.choices[0];
        if (!delta || typeof delta !== 'object' || Array.isArray(delta) || delta.tool_calls?.length || delta.function_call || delta.audio || delta.refusal) throw Error('Unsupported non-text completion');
        if (delta.content != null) {
          if (typeof delta.content !== 'string' || characters + delta.content.length > maxOutputChars) throw Error('Invalid or oversized text');
          characters += delta.content.length; if (delta.content) yield delta.content;
        }
        if (reason != null) {if (reason !== 'stop') throw Error('Incomplete completion'); finished = true;}
      }
      if (!finished || !terminal) throw Error('Truncated completion');
    } catch (error) {
      if (combined.aborted) throw combined.reason;
      throw new Error('Chat source stream failed or did not complete.');
    } finally {onUsage(usage);}
  }};
}

