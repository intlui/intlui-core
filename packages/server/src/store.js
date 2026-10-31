import {ChatError} from './errors.js';

// Bounded, process-local storage. Custom stores must enforce owner isolation and
// atomic claims themselves, including across replicas. No credentials are stored.
export function createMemoryConversationStore({maxEntries = 1000, maxBytes = 8388608, ttlMs = 3600000} = {}) {
  for (const value of [maxEntries, maxBytes, ttlMs]) if (!Number.isSafeInteger(value) || value < 1) throw TypeError('Invalid store limits');
  const receipts = new Map(), turns = new Map(); let bytes = 0;
  const key = (owner, id) => JSON.stringify([owner, id]);
  function prune() {
    const now = Date.now();
    for (const [id, expires] of receipts) if (expires <= now) receipts.delete(id);
    for (const [id, entry] of turns) if (entry.expires <= now) {turns.delete(id); bytes -= entry.bytes;}
  }
  return {
    async claim(owner, requestId) {
      prune(); const id = key(owner, requestId);
      if (receipts.has(id)) return false;
      if (receipts.size >= maxEntries) throw new ChatError(429, 'request_records_limit');
      receipts.set(id, Date.now() + ttlMs); return true;
    },
    async get(owner, turnId) {prune(); return structuredClone(turns.get(key(owner, turnId))?.value ?? null);},
    async save(owner, turn) {
      prune(); const id = key(owner, turn.turnId), previous = turns.get(id);
      const value = structuredClone(turn), size = new TextEncoder().encode(JSON.stringify(value)).length;
      if ((!previous && turns.size >= maxEntries) || bytes - (previous?.bytes || 0) + size > maxBytes) throw new ChatError(503, 'storage_limit');
      bytes += size - (previous?.bytes || 0); turns.set(id, {value, bytes:size, expires:Date.now() + ttlMs});
    }
  };
}
