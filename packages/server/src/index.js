import {validateRequest, createTurnState, reduceEvent, UI_PROFILE, profileKey, sameProfile} from '@intlui/protocol';
import {runTranslation} from './translation-pipeline.js';
import {createMemoryConversationStore} from './store.js';
import {ChatError} from './errors.js';
import {serverProfiles, createUiProfile} from './profiles.js';
export {createUiProfile} from './profiles.js';
export {createMemoryConversationStore} from './store.js';
export {createOpenAiProvider} from './provider.js';
export {composeProvider} from './compose-provider.js';

const defaults = {maxBodyBytes:131072, maxInputChars:4096, maxConcurrentPerUser:2, maxConcurrent:100,
  timeoutMs:120000, maxHistoryTurns:8, maxHistoryChars:64000, intervalMs:1, flushMs:700, maxBatch:6000,
  maxTranslations:24, maxOutputChars:30000, initialBatchChars:256, initialFlushMs:2800};
const responseError = error => Response.json({error:{code:error instanceof ChatError ? error.code : 'server_error'}},
  {status:error instanceof ChatError ? error.status : 500, headers:{'Cache-Control':'no-store'}});

async function readRequest(request, limit, signal) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ChatError(415, 'invalid_request');
  const reader = request.body?.getReader(); if (!reader) throw new ChatError(400, 'invalid_request');
  const abort = () => {void reader.cancel().catch(() => {});};
  signal.addEventListener('abort', abort, {once:true});
  try {
    const decoder = new TextDecoder('utf-8', {fatal:true}); let text = '', bytes = 0;
    while (true) {
      signal.throwIfAborted(); const {done, value} = await reader.read(); signal.throwIfAborted();
      bytes += value?.byteLength || 0;
      if (bytes > limit) throw new ChatError(413, 'input_limit');
      text += decoder.decode(value, {stream:!done}); if (done) break;
    }
    try {return validateRequest(JSON.parse(text));} catch {throw new ChatError(400, 'invalid_request');}
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError(signal.aborted ? 408 : 400, 'invalid_request');
  } finally {signal.removeEventListener('abort', abort); abort(); reader.releaseLock();}
}

/** Mount at any route. Identity always comes from the application's authenticator. */
export function createChatHandler({provider, authenticate, store = createMemoryConversationStore(), projectId = 'self-hosted',
  allowedOrigins = [], limits: overrides = {}, onUsage = () => {}, profiles = [createUiProfile()], authorizeProfile = () => true} = {}) {
  const registry = serverProfiles(profiles);
  if(typeof authorizeProfile !== 'function')throw TypeError('Invalid profile authorization');
  if (!provider || typeof provider.translate !== 'function' || !Array.isArray(provider.modes) ||
      provider.modes.some(mode => !['generate','translate'].includes(mode)) || !provider.modes.length ||
      (provider.modes.includes('generate') && typeof provider.generate !== 'function')) throw TypeError('Invalid provider');
  if (typeof authenticate !== 'function' || typeof onUsage !== 'function') throw TypeError('An authenticate function is required');
  if (!['claim','get','save'].every(name => typeof store?.[name] === 'function')) throw TypeError('Invalid conversation store');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(projectId)) throw TypeError('Invalid projectId');
  if (!Array.isArray(allowedOrigins) || allowedOrigins.some(origin => new URL(origin).origin !== origin)) throw TypeError('Invalid allowedOrigins');
  const origins = new Set(allowedOrigins), limits = {...defaults, ...overrides};
  for (const [name, value] of Object.entries(limits)) if (!(name in defaults) || !Number.isSafeInteger(value) || value < 1) throw TypeError(`Invalid limit: ${name}`);
  if (limits.maxOutputChars > 30000 || limits.maxBatch < 2 || limits.maxBatch > 30000 || limits.maxTranslations > 100 || limits.timeoutMs > 2147483647) throw TypeError('Invalid pipeline limits');
  const active = new Map(); let total = 0;
  return async function handle(request) {
    let owner, admitted = false, streaming = false;
    const stop = new AbortController();
    const signal = AbortSignal.any([request.signal, stop.signal, AbortSignal.timeout(limits.timeoutMs)]);
    function release() {
      if (!admitted) return; admitted = false; total--;
      const count = active.get(owner) - 1; if (count) active.set(owner, count); else active.delete(owner);
    }
    try {
      if (request.method !== 'POST') throw new ChatError(405, 'invalid_request');
      const origin = request.headers.get('origin');
      // Same-origin by default; extra origins require an explicit allowlist.
      if (origin && origin !== new URL(request.url).origin && !origins.has(origin)) throw new ChatError(403, 'origin_denied');
      const identity = await authenticate(request);
      if (!identity || typeof identity.userId !== 'string' || !identity.userId.trim() || identity.userId.length > 256) throw new ChatError(401, 'unauthorized');
      owner = identity.userId; signal.throwIfAborted();
      if (total >= limits.maxConcurrent || (active.get(owner) || 0) >= limits.maxConcurrentPerUser) throw new ChatError(429, 'concurrency_limit');
      admitted = true; total++; active.set(owner, (active.get(owner) || 0) + 1);
      const input = await readRequest(request, limits.maxBodyBytes, signal);
      const profileAdapter = registry.get(profileKey(input.capabilities.profile ?? UI_PROFILE));
      if(!profileAdapter)throw new ChatError(400,'unsupported_profile');
      if(await authorizeProfile({identity,profile:profileAdapter.profile,request}) !== true)throw new ChatError(403,'profile_denied');
      signal.throwIfAborted();
      if (!provider.modes.includes(input.input.mode)) throw new ChatError(400, 'unsupported_mode');
      if (input.input.text.length > limits.maxInputChars) throw new ChatError(413, 'input_limit');
      const history = []; let id = input.previousTurnId, conversationId, chars = 0;
      for (let count = 0; id && count < limits.maxHistoryTurns; count++) {
        const prior = await store.get(owner, id);
        if (!prior) throw new ChatError(404, 'conversation_not_found');
        if(!sameProfile(prior.profile ?? UI_PROFILE, profileAdapter.profile))throw new ChatError(409,'conversation_profile_mismatch');
        if (prior.status !== 'complete' || prior.mode !== 'generate') throw new ChatError(409, 'conversation_incomplete');
        const size = prior.userText.length + prior.text.length;
        if (chars + size > limits.maxHistoryChars) {if (!count) throw new ChatError(413, 'conversation_limit'); break;}
        conversationId ??= prior.conversationId;
        history.unshift({role:'user', content:prior.userText}, {role:'assistant', content:prior.text});
        chars += size; id = prior.previousTurnId;
      }
      signal.throwIfAborted();
      if (!await store.claim(owner, input.requestId)) throw new ChatError(409, 'idempotency_conflict');
      const scope = {projectId, conversationId:conversationId || crypto.randomUUID(), turnId:crypto.randomUUID()};
      let state = createTurnState(scope, input.capabilities, input.version), wake;
      const notify = () => {wake?.(); wake = undefined;};
      signal.addEventListener('abort', notify, {once:true});
      const body = new ReadableStream({
        start(controller) {
          const emit = async payload => {
            signal.throwIfAborted();
            while (controller.desiredSize <= 0) {await new Promise(resolve => {wake = resolve;}); signal.throwIfAborted();}
            const event = {...scope, version:input.version, sequence:state.sequence + 1, turnRevision:0, ...payload};
            state = reduceEvent(state, event);
            controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
          };
          const usage = usage => {
            // Telemetry cannot break generation or expose provider details to the browser.
            try {void Promise.resolve(onUsage({userId:owner, turnId:scope.turnId, usage})).catch(() => {});} catch {}
          };
          void (async () => {
            try {
              const status = await runTranslation({provider, input, history, signal, emit, onUsage:usage, ...limits, profileAdapter});
              signal.throwIfAborted();
              await store.save(owner, {...scope, mode:input.input.mode, userText:input.input.text, text:state.text,
                previousTurnId:input.previousTurnId, profile:profileAdapter.profile, status});
              await emit({type:'turn.end', status, ...(status === 'complete' ? {} : {reason:'UI translation was incomplete; original text is preserved.'})});
              controller.close();
            } catch {
              if (signal.aborted) {try {controller.error(new Error('Chat interrupted'));} catch {}}
              else {
                try {
                  await emit({type:'error', code:'generation_failed', message:'Unable to complete the response.'});
                  await emit({type:'turn.end', status:'failed', reason:'Unable to complete the response.'});
                  controller.close();
                } catch {try {controller.error(new Error('Chat interrupted'));} catch {}}
              }
            } finally {signal.removeEventListener('abort', notify); stop.abort(); release();}
          })();
        },
        pull() {notify();},
        cancel() {stop.abort(); notify();}
      }, {highWaterMark:65536, size:chunk => chunk.byteLength});
      streaming = true;
      return new Response(body, {headers:{'Content-Type':'application/x-ndjson; charset=utf-8', 'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff', 'X-Accel-Buffering':'no', 'x-intlui-turn-id':scope.turnId}});
    } catch (error) {return responseError(error);}
    finally {if (!streaming) {stop.abort(); release();}}
  };
}
