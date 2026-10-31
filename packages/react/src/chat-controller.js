import {startTurn} from '@intlui/client';
import {PROTOCOL_VERSION} from '@intlui/protocol';

const lostContext = error => ['conversation_not_found','conversation_incomplete','conversation_limit','conversation_profile_mismatch'].includes(error.code);

// Transport lifecycle separated from React so cancellation and late callbacks can
// be exercised deterministically. Stable item IDs preserve renderer-local state.
export function createChatController({mode = 'generate', intent = 'Present useful interactive UI without changing the source facts.',
  maxTurns = 20, protocolVersion = PROTOCOL_VERSION, capabilities, ...connection}) {
  if (!['generate','translate'].includes(mode) || !Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > 100) throw TypeError('Invalid chat options');
  let snapshot = {items:[], busy:false, error:null, contextLost:false}, active = null, parent;
  const listeners = new Set();
  const update = patch => {snapshot = {...snapshot, ...patch}; for (const listener of listeners) listener();};
  const cancel = () => {
    const current = active; if (!current) return;
    active = null; current.stop.abort();
    update({busy:false, items:snapshot.items.map(item => item.id === current.id && !item.state?.terminal ? {...item, interruption:'cancelled'} : item)});
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
    stop: cancel,
    reset() {cancel(); parent = undefined; update({items:[], busy:false, error:null, contextLost:false});},
    async send(text) {
      if (active) throw Error('A response is already running');
      if (snapshot.contextLost) throw Error('Start a new conversation');
      if (typeof text !== 'string' || !text.trim() || text.length > 30000) throw TypeError('Invalid message');
      const current = {id:crypto.randomUUID(), stop:new AbortController()}; active = current;
      update({busy:true, error:null, items:[...snapshot.items, {id:current.id, prompt:text, state:null}].slice(-maxTurns)});
      try {
        const result = await startTurn({...connection, signal:current.stop.signal,
          request:{version:protocolVersion, requestId:current.id, input:{mode, text}, intent, capabilities,
            ...(mode === 'generate' && parent ? {previousTurnId:parent} : {})},
          onState(state) {
            if (active !== current) return;
            update({items:snapshot.items.map(item => item.id === current.id ? {...item, state} : item)});
          }});
        if (active === current && mode === 'generate' && result.status === 'complete') parent = result.turnId;
        return result;
      } catch (error) {
        if (active === current) update({error:current.stop.signal.aborted ? null : error, contextLost:lostContext(error),
          items:snapshot.items.map(item => item.id === current.id ? {...item, interruption:current.stop.signal.aborted ? 'cancelled' : 'disconnected'} : item)});
        throw error;
      } finally {if (active === current) {active = null; update({busy:false});}}
    }
  };
}
