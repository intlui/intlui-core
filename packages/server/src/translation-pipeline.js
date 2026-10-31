import { setTimeout as delay } from 'node:timers/promises';
import { supportsBlock, validateEvent, UI_PROFILE, sameProfile, validateRequest, validateCapabilities } from '@intlui/protocol';
import {createUiProfile} from './profiles.js';

// Text and translation run concurrently; only complete validated operations reach
// the wire. The caller serializes emission and owns authentication and history.
export async function runTranslation({ provider, input, history = [], sourceStream, signal, emit: output, onUsage, intervalMs,
  flushMs, maxBatch, maxTranslations, maxOutputChars, initialBatchChars = 256, initialFlushMs = flushMs * 4,
  profileAdapter = createUiProfile() }) {
  if(input.version !== undefined)validateRequest(input);
  else validateCapabilities(input.capabilities);
  if (!sameProfile(input.capabilities.profile ?? UI_PROFILE, profileAdapter.profile)) throw TypeError('Profile adapter mismatch');
  const stop = new AbortController(), combined = AbortSignal.any([signal, stop.signal]);
  const blocks = new Map(), artifacts = new Map(), usedIds = new Set();
  let pending = '', timer, job, calls = 0, failures = 0, length = 0, done = false, disabled = false, finalPending = false, fatal;
  const scope = { version: input.version ?? '0.1', projectId: 'validation', conversationId: 'validation', turnId: 'validation', sequence: 1, turnRevision: 0 };
  async function emit(payload) {
    try { await output(payload); }
    catch (error) {
      // A failed host write is fatal, unlike an invalid model operation. Stop
      // a source waiting for its next token, not only the translation job.
      fatal ??= error;
      stop.abort(error);
      throw error;
    }
  }
  async function apply(operation) {
    combined.throwIfAborted();
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw Error('Invalid operation.');
    const allowed = operation.type === 'create' ? ['type', 'id', 'source', 'appData'] : operation.type === 'data' ? ['type', 'id', 'appData'] : ['type', 'id'];
    if (Object.keys(operation).some(key => !allowed.includes(key))) throw Error('Unknown operation field.');
    const prior = blocks.get(operation.id);
    let payload, next, artifact;
    if (operation.type === 'create') {
      if (usedIds.has(operation.id) || blocks.size >= 24) throw Error('Block identity cannot be replaced.');
      if (typeof operation.source !== 'string' || !operation.source.trim() || operation.source.length > 50000) throw TypeError('Invalid source');
      const compiled = await profileAdapter.compile(operation.source, {signal:combined});
      if (!compiled || !Object.hasOwn(compiled,'artifact')) throw TypeError('Invalid profile compilation');
      artifact = compiled.artifact;
      next = { id: operation.id, format: 'dil', source: operation.source, appData: operation.appData ?? {}, revision: 1,
        requiredComponents:compiled.requiredComponents, ...(input.capabilities.profile ? {profile:profileAdapter.profile} : {}) };
      payload = { type: 'ui.create', block: next };
    } else if (operation.type === 'data' && prior) {
      next = { ...prior, appData: operation.appData, revision: prior.revision + 1 };
      payload = { type: 'ui.data', id: next.id, appData: next.appData, revision: next.revision };
    } else if (operation.type === 'remove' && prior) {
      payload = { type: 'ui.remove', id: prior.id };
    } else throw Error('Unknown block or operation.');
    validateEvent({ ...scope, ...payload });
    if (next) {
      if (!supportsBlock(input.capabilities, next)) throw Error('Unsupported client capabilities.');
      const valid = await profileAdapter.validateData(operation.type === 'create' ? artifact : artifacts.get(next.id),
        structuredClone(next.appData), {signal:combined, previousAppData:prior ? structuredClone(prior.appData) : undefined});
      if (valid === false) throw TypeError('Invalid profile data');
      const context = [...blocks.values()].filter(block => block.id !== next.id).concat(next);
      if (JSON.stringify(context).length > 60000) throw Error('Translation context limit.');
    }
    await emit(payload);
    if (next) { blocks.set(next.id, next); usedIds.add(next.id); if(operation.type === 'create')artifacts.set(next.id,artifact); }
    else {blocks.delete(prior.id);artifacts.delete(prior.id);}
  }
  function pump() {
    if (job || disabled || combined.aborted || (!pending.trim() && !finalPending)) return;
    let end = Math.min(maxBatch, pending.length);
    // Keep UTF-16 pairs together, including a pair split across source chunks.
    // A trailing high surrogate waits for the next chunk unless source EOF is known.
    if (end && /[\uD800-\uDBFF]/.test(pending[end - 1]) &&
      ((end < pending.length && /[\uDC00-\uDFFF]/.test(pending[end])) || (end === pending.length && !done))) end--;
    if (!end && !finalPending) return;
    if (calls >= maxTranslations) {
      disabled = true; pending = ''; failures++;
      job = emit({ type: 'error', code: 'translation_limit', message: 'Translation call budget reached; original text remains available.' }).catch(error => { fatal = error; }).finally(() => { job = null; });
      return;
    }
    clearTimeout(timer); timer = null;
    const delta = pending.slice(0, end); pending = pending.slice(delta.length); calls++;
    const sourceComplete = done && !pending.trim();
    finalPending = false;
    job = (async () => {
      try {
        await emit({ type: 'status', status: 'translating' });
        for await (const operation of provider.translate({ intent: input.intent, capabilities: structuredClone(input.capabilities),
          profile:profileAdapter.profile, instructions:profileAdapter.instructions,
          delta, blocks: structuredClone([...blocks.values()]), sourceComplete, signal: combined, onUsage })) {
          await apply(operation);
        }
      } catch (error) {
        if (!combined.aborted) {
          failures++;
          onUsage(null);
          await emit({ type: 'error', code: 'translation_failed', message: 'UI translation failed validation or provider completion; original text remains available.' });
        }
      }
    })().catch(error => { fatal = error; disabled = true; pending = ''; }).finally(() => {
      job = null;
      // Data accumulated during translation is already waiting: do not add
      // another timer delay when the previous request has finished.
      if (done || pending.trim()) pump();
    });
    // The source loop or finish awaits this promise; avoid an unhandled rejection
    // if the HTTP history budget fails while the producer is waiting for tokens.
    job.catch(() => {});
  }
  function schedule() {
    if (disabled || combined.aborted) return;
    if (!calls) {
      // Avoid spending the first model request on a tiny introductory fragment.
      // This is bounded buffering, not a claim that N characters imply facts.
      if (pending.length >= Math.min(initialBatchChars, maxBatch)) pump();
      else if (!timer) timer = setTimeout(() => { timer = null; pump(); }, initialFlushMs);
      return;
    }
    if (pending.length >= maxBatch || /[.!?]\s|\n/.test(pending)) pump();
    if (pending && !timer) timer = setTimeout(() => { timer = null; pump(); if (pending) schedule(); }, flushMs);
  }
  async function* suppliedText() {
    const characters = Array.from(input.input.text);
    for (let i = 0; i < characters.length; i += 64) {
      await delay(intervalMs, undefined, { signal: combined });
      yield characters.slice(i, i + 64).join('');
    }
  }
  try {
    await emit({ type: 'status', status: 'receiving' });
    const source = sourceStream ?? (input.input.mode === 'generate' ? provider.generate({ text: input.input.text, history, signal: combined, onUsage }) : suppliedText());
    for await (const chunk of source) {
      combined.throwIfAborted();
      if (fatal) throw fatal;
      if (typeof chunk !== 'string' || length + chunk.length > maxOutputChars) throw Error('Source output limit.');
      if (!chunk) continue;
      length += chunk.length;
      await emit({ type: 'text.delta', text: chunk });
      // Text-only surfaces avoid paid translation calls entirely.
      if (input.capabilities.formats.includes('dil') && !disabled) { pending += chunk; schedule(); }
    }
    done = true;
    // An explicit end frame may arrive after the last text batch was translated.
    // Give the translator one final completion signal, within the same budget.
    if (sourceStream && calls && !pending.trim()) finalPending = true;
    clearTimeout(timer); pump();
    while (job) await job;
    if (fatal) throw fatal;
    return failures ? 'partial' : 'complete';
  } catch (error) {
    throw fatal ?? error;
  } finally {
    clearTimeout(timer); stop.abort('pipeline_finished');
    // Provider adapters must honor their signal. Late operations are also gated
    // above, even for a misbehaving test/custom adapter.
    if (job) await job.catch(() => {});
  }
}
