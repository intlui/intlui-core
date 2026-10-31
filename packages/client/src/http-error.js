const knownCodes = new Set(['unauthorized', 'origin_denied', 'conversation_not_found', 'conversation_incomplete', 'conversation_active', 'conversation_limit', 'idempotency_conflict', 'request_active',
  'session_turn_quota', 'concurrency_limit', 'turn_quota', 'input_limit', 'input_backpressure', 'input_sequence', 'input_closed',
  'replay_expired', 'request_records_limit', 'usage_unavailable', 'unsupported_mode', 'storage_limit', 'history_limit', 'invalid_request',
  'unsupported_profile', 'profile_denied', 'conversation_profile_mismatch']);

export class IntluiHttpError extends Error {
  constructor(status, code = 'http_error') {
    super(status === 410 && code === 'replay_expired' ? 'The temporary response is no longer available. The request will not be retried.' :
      status === 401 || status === 403 ? 'Unauthorized session. Check the project token.' :
      status === 404 || status === 409 ? 'Conversation unavailable. Start a new conversation.' :
      status === 429 ? 'Project limit reached. Try again later.' : `Request failed (${status}).`);
    this.name = 'IntluiHttpError'; this.status = status; this.code = code;
  }
}

// Never expose arbitrary upstream messages. Bound both error-body size and wait.
export async function httpError(response, signal) {
  const stop = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(1000)]);
  let code = 'http_error', reader, cancel;
  try {
    reader = response.body?.getReader();
    if (reader) {
      cancel = () => {void reader.cancel().catch(() => {});};
      stop.addEventListener('abort', cancel, {once: true});
      stop.throwIfAborted();
      const decoder = new TextDecoder('utf-8', {fatal: true}); let text = '', bytes = 0;
      while (true) {
        const {value, done} = await reader.read(); stop.throwIfAborted();
        bytes += value?.byteLength || 0; if (bytes > 8192) break;
        text += decoder.decode(value, {stream: !done});
        if (done) {const candidate = JSON.parse(text)?.error?.code; if (knownCodes.has(candidate)) code = candidate; break;}
      }
    }
  } catch {} finally {if (reader) {stop.removeEventListener('abort', cancel); cancel?.(); reader.releaseLock();}}
  signal?.throwIfAborted();
  return new IntluiHttpError(response.status, code);
}
