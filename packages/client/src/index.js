import {batchSource} from './batch-source.js';
import {httpError} from './http-error.js';
export {IntluiHttpError} from './http-error.js';
export {createTextSource} from './text-source.js';
export {createTranscriptSource} from './transcript-source.js';
export {createOpenAIRealtimeSource} from './openai-realtime-source.js';
export {subscribeOpenAIRealtimeSource} from './realtime-subscription.js';
import { createTurnState, reduceEvent, validateEvent, validateRequest, validateInputFrame } from '@intlui/protocol';

export async function* readEvents(body, { signal } = {}) {
  if (!body) throw new Error('Response has no stream.');
  const reader = body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '', cancelled = false;
  const cancelReader = () => {
    if (cancelled) return;
    cancelled = true;
    // Cancellation resolves a pending read even when the fetch implementation
    // ignores its signal. Do not wait for a slow underlying cancel hook.
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancelReader, { once: true });
  try {
    signal?.throwIfAborted();
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, boundary).trim(); buffer = buffer.slice(boundary + 1);
        if (line.length > 250000) throw new Error('Event is too large.');
        signal?.throwIfAborted();
        if (line) yield validateEvent(JSON.parse(line));
      }
      if (buffer.length > 250000) throw new Error('Event is too large.');
      if (done) break;
    }
    signal?.throwIfAborted();
    if (buffer.trim()) yield validateEvent(JSON.parse(buffer));
  } finally { signal?.removeEventListener('abort', cancelReader); cancelReader(); reader.releaseLock(); }
}

// No storage, implicit retry, provider key or React dependency.
export async function startTurn({ apiBaseUrl = '', endpoint, token, request, projectId, signal, onState, fetchImpl = fetch }) {
  signal?.throwIfAborted();
  request = structuredClone(request);
  validateRequest(request);
  const base = resolveBase(apiBaseUrl);
  if (endpoint === undefined && (typeof token !== 'string' || !token.trim())) throw new TypeError('Session token required');
  if (token !== undefined && (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token))) throw new TypeError('Invalid session token');
  const target = endpoint === undefined ? `${base}/v1/turns` : resolveEndpoint(endpoint);
  if (endpoint !== undefined && apiBaseUrl !== '') throw new TypeError('Use endpoint or apiBaseUrl, not both');
  const response = await fetchImpl(target, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) },
    body: JSON.stringify(request)
  });
  if (!response.ok) throw await httpError(response, signal);
  let state = null;
  for await (const event of readEvents(response.body, { signal })) {
    signal?.throwIfAborted();
    if (projectId !== undefined && event.projectId !== projectId) throw new Error('Unexpected project in stream.');
    state ??= createTurnState({ projectId: event.projectId, conversationId: event.conversationId, turnId: event.turnId }, request.capabilities, request.version);
    state = reduceEvent(state, event);
    onState?.(state);
    // A validated terminal event completes the turn even if the HTTP peer
    // leaves its response open. Exiting releases and cancels the reader.
    if (state.terminal) break;
  }
  if (!state?.terminal) throw new Error('Connection ended before completion. Received content is preserved.');
  return state;
}


function resolveBase(apiBaseUrl) {
  let base = '';
  if (apiBaseUrl !== '' && apiBaseUrl !== '/') {
    const url = new URL(apiBaseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new TypeError('API base must be an HTTP(S) origin or /');
    base = url.origin;
  }
  return base;
}

function resolveEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint || /[\\\s]/.test(endpoint)) throw new TypeError('Invalid chat endpoint');
  const relative = endpoint.startsWith('/') && !endpoint.startsWith('//');
  const url = new URL(endpoint, relative ? 'https://intlui.invalid' : undefined);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new TypeError('Invalid chat endpoint');
  return relative ? url.pathname : url.href;
}

export async function appendInput({apiBaseUrl = '', token, turnId, frame, signal, fetchImpl = fetch}) {
  signal?.throwIfAborted();
  frame = validateInputFrame(structuredClone(frame));
  if (typeof turnId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(turnId)) throw new TypeError('Invalid turn ID');
  if (typeof token !== 'string' || !token.trim()) throw new TypeError('Session token required');
  const response = await fetchImpl(`${resolveBase(apiBaseUrl)}/v1/turns/${turnId}/input`, {
    method: 'POST', signal,
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
    body: JSON.stringify(frame)
  });
  if (!response.ok) throw await httpError(response, signal);
  const result = await response.json();
  if (result.turnId !== turnId || result.nextSequence !== frame.sequence + 1 || typeof result.replayed !== 'boolean') throw new Error('Invalid input acknowledgement');
  return result;
}


// Higher-level producer bridge. Adapters must honor the supplied signal.
export async function translateTextStream({source, chunkChars = 1024, flushMs = 100, ...options}) {
  if (options.endpoint !== undefined) throw new TypeError('Streaming input requires the platform API, not a custom endpoint');
  if (typeof source !== 'function' || !Number.isSafeInteger(chunkChars) || chunkChars < 2 || chunkChars > 4096 || !Number.isSafeInteger(flushMs) || flushMs < 0 || flushMs > 2000) throw new TypeError('Invalid streaming source or chunk size');
  if (options.request?.input?.mode !== 'translate-stream' || options.request.input.text !== '') throw new TypeError('Expected an empty translate-stream request');
  options.signal?.throwIfAborted();
  const stop = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, stop.signal]) : stop.signal;
  let ready, rejectReady, receiverSettled = false, replayed = false, producerFailed = false, producerError;
  const started = new Promise((resolve, reject) => {ready = resolve; rejectReady = reject;});
  const reading = startTurn({...options, signal, fetchImpl: async (...args) => {
    const response = await (options.fetchImpl || fetch)(...args);
    replayed = response.headers.get('x-intlui-replayed') === 'true';
    return response;
  }, onState(state) {options.onState?.(state); ready(state.turnId);}});
  // Install completion/error handlers before the producer awaits its first turn ID.
  reading.then(() => {receiverSettled = true; stop.abort(); rejectReady(new Error('Output ended before input started'));}, error => {
    receiverSettled = true; stop.abort(); rejectReady(error);
  });
  const producing = (async () => {
    let iterator;
    try {
      const turnId = await started;
      if (replayed) return;
      signal.throwIfAborted();
      iterator = source({signal})[Symbol.asyncIterator]();
      let sequence = 1;
      for await (const text of batchSource(iterator, {signal, chunkChars, flushMs})) {
        await appendInput({...options, signal, turnId, frame: {sequence, text, end: false}});
        sequence++;
      }
      await appendInput({...options, signal, turnId, frame: {sequence, text: '', end: true}});
    } catch (error) {
      if (!receiverSettled) {producerFailed = true; producerError = error; stop.abort();}
      throw error;
    } finally {
      // A source ignoring abort can leave return() pending. Never block cancellation on it.
      try { const closed = iterator?.return?.(); if (closed) void Promise.resolve(closed).catch(() => {}); } catch {}
    }
  })();
  const [received] = await Promise.allSettled([reading, producing]);
  if (producerFailed) throw producerError;
  if (received.status === 'rejected') throw received.reason;
  return received.value;
}

