/** Single-consumer bridge from push events to an async text iterable. */
export function createTextSource({signal, maxBufferedChars = 30000, maxBufferedChunks = 1024} = {}) {
  if (![maxBufferedChars, maxBufferedChunks].every(value => Number.isSafeInteger(value) && value > 0)) throw TypeError('Invalid text source limits');
  const queue = []; let characters = 0, ended = false, failure, failed = false, pending, claimed = false;
  const detach = () => signal?.removeEventListener('abort', abort);
  const result = () => {
    if (queue.length) {const value = queue.shift(); characters -= value.length; return {value, done: false};}
    if (ended) {detach(); if (failed) throw failure; return {value: undefined, done: true};}
    return null;
  };
  const wake = () => {
    if (!pending) return;
    const waiter = pending; pending = undefined;
    try {waiter.resolve(result());} catch (error) {waiter.reject(error);}
  };
  const abort = () => {queue.length = 0; characters = 0; ended = true; failure = signal.reason; failed = true; detach(); wake();};
  const fail = error => {
    if (!(error instanceof Error)) throw TypeError('Text source failure must be an Error');
    if (ended) return;
    ended = true; failure = error; failed = true; wake();
    if (!queue.length) detach();
  };
  signal?.addEventListener('abort', abort, {once: true});
  if (signal?.aborted) abort();
  const iterator = {
    async next() {
      if (pending) throw TypeError('Concurrent text source reads are not supported');
      const item = result(); if (item) return item;
      return new Promise((resolve, reject) => {pending = {resolve, reject};});
    },
    async return() {
      queue.length = 0; characters = 0; ended = true; failure = undefined; failed = false; detach(); wake();
      return {value: undefined, done: true};
    },
  };
  return {
    get bufferedChars() {return characters;},
    get closed() {return ended;},
    push(text) {
      if (ended) throw Error('Text source is closed');
      if (typeof text !== 'string') {const error = TypeError('Text source chunks must be strings'); fail(error); throw error;}
      if (!text) return;
      if (characters + text.length > maxBufferedChars || queue.length >= maxBufferedChunks) {
        const error = RangeError('Text source buffer limit exceeded'); fail(error); throw error;
      }
      queue.push(text); characters += text.length; wake();
    },
    end() {if (!ended) {ended = true; wake(); if (!queue.length) detach();}},
    fail,
    [Symbol.asyncIterator]() {if (claimed) throw TypeError('Text source allows only one consumer'); claimed = true; return iterator;},
  };
}
