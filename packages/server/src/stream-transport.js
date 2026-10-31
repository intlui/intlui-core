export const STREAM_DONE = Symbol('stream-done');
// Decode either SSE or NDJSON across arbitrary byte/UTF-8 boundaries.
export async function* readJsonStream(body, format = 'ndjson', {includeDone = false} = {}) {
  const decoder = new TextDecoder('utf-8', {fatal: true}); let buffer = '';
  const parse = frame => {
    const text = format === 'sse' ? frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n') : frame;
    if (text.trim() === '[DONE]') return includeDone ? STREAM_DONE : null;
    if (!text.trim()) return null;
    return JSON.parse(text);
  };
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    // Normalize CRLF only when a complete boundary can be recognized.
    const separator = format === 'sse' ? /\r?\n\r?\n/ : /\r?\n/;
    let match;
    while ((match = separator.exec(buffer))) {
      if (match.index > 250000) throw Error('Stream frame too large');
      const frame = buffer.slice(0, match.index).replace(/\r\n/g, '\n'); buffer = buffer.slice(match.index + match[0].length);
      const value = parse(frame); if (value) yield value;
    }
    if (buffer.length > 250000) throw Error('Stream frame too large');
  }
  buffer += decoder.decode();
  if (buffer.trim()) { const value = parse(buffer); if (value) yield value; }
}

export async function* responseText({ input, instructions, apiKey, model, signal, fetchImpl = fetch, onEvent = () => {}, maxOutputTokens = 8192 }) {
  if (!apiKey?.trim()) throw Error('Configura OPENAI_API_KEY in .env.local.');
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ model, input, instructions, stream: true, store: false, max_output_tokens: maxOutputTokens }),
  });
  if (!response.ok || !response.body) {void response.body?.cancel().catch(() => {}); throw Error(`Provider stream unavailable (${response.status}).`);}
  let completed = false, first = true;
  for await (const event of readJsonStream(abortableBytes(response.body, signal), 'sse')) {
    signal?.throwIfAborted();
    if (event.type === 'response.output_text.delta') { if (typeof event.delta !== 'string') throw Error('Invalid text delta.'); if (first) { first = false; onEvent({ stage: 'first_token' }); } yield event.delta; }
    if (['error', 'response.failed', 'response.incomplete', 'response.refusal.done'].includes(event.type)) throw Error('Provider did not complete the streaming response.');
    if (event.type === 'response.completed') { completed = true; onEvent({ stage: 'completed', usage: event.response?.usage || null }); break; }
  }
  if (!completed) throw Error('Connection closed before provider completion.');
}

// Release stalled reads on abort, and never await an uncooperative cancel hook.
export async function* abortableBytes(body, signal) {
  const reader = body.getReader(); let cancelled = false;
  const cancel = () => {if (!cancelled) {cancelled = true; void reader.cancel().catch(() => {});}};
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    signal?.throwIfAborted();
    while (true) {const {done, value} = await reader.read(); signal?.throwIfAborted(); if (done) return; yield value;}
  } finally {signal?.removeEventListener('abort', cancel); cancel(); reader.releaseLock();}
}
