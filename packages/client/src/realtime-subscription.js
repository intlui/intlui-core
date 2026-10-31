import {createOpenAIRealtimeSource} from './openai-realtime-source.js';

const open = transport => transport.readyState === 1 || transport.readyState === 'open';
const transportFailure = () => Object.assign(Error('Realtime event transport failed or supplied an invalid message.'), {code: 'realtime_transport'});

/** Subscribe immediately to a caller-owned, already-open EventTarget transport. */
export function subscribeOpenAIRealtimeSource({transport, maxMessageChars = 1000000, signal: externalSignal, ...options} = {}) {
  if (!transport || typeof transport.addEventListener !== 'function' || typeof transport.removeEventListener !== 'function' || !open(transport) ||
    !Number.isSafeInteger(maxMessageChars) || maxMessageChars < 1) throw TypeError('An open Realtime event transport and valid limits are required');
  const stop = new AbortController(), signal = externalSignal ? AbortSignal.any([externalSignal, stop.signal]) : stop.signal;
  const source = createOpenAIRealtimeSource({...options, signal}), installed = new Set();
  const handlers = {
    message(event) {
      if (source.closed) {detach(); return;}
      try {
        if (typeof event.data !== 'string' || event.data.length > maxMessageChars) throw transportFailure();
        let decoded;
        try {decoded = JSON.parse(event.data);} catch {throw transportFailure();}
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) || typeof decoded.type !== 'string') throw transportFailure();
        source.push(decoded);
        if (source.closed) detach();
      } catch (error) {fail(error);}
    },
    close() {try {source.end();} catch {} finally {detach();}},
    error() {fail(transportFailure());},
  };
  function detach() {
    for (const type of installed) transport.removeEventListener(type, handlers[type]);
    installed.clear(); signal.removeEventListener('abort', detach);
  }
  function fail(error) {
    if (!(error instanceof Error)) throw TypeError('Realtime failure must be an Error');
    try {source.fail(error);} finally {detach();}
  }
  const dispose = () => {stop.abort(); detach();};
  if (!signal.aborted) {
    signal.addEventListener('abort', detach, {once: true});
    try {
      for (const type of Object.keys(handlers)) {transport.addEventListener(type, handlers[type]); installed.add(type);}
      // Cover a close that raced with listener registration.
      if (!open(transport)) fail(transportFailure());
    } catch (error) {dispose(); throw error;}
  }
  return {
    get closed() {return source.closed;},
    get bufferedChars() {return source.bufferedChars;},
    fail,
    dispose,
    [Symbol.asyncIterator]() {
      const iterator = source[Symbol.asyncIterator]();
      return {next: () => iterator.next(), return: () => {detach(); return iterator.return();}};
    },
  };
}
