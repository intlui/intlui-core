// Pull at most one pending source item. Keep a deadline for the oldest buffered text.
export async function* batchSource(iterator, {signal, chunkChars, flushMs}) {
  let buffer = '', deadline = 0, pending, done = false, failure, failed = false;
  while (true) {
    signal.throwIfAborted();
    if (buffer && (buffer.length >= chunkChars || done || failed || flushMs === 0 || Date.now() >= deadline)) {
      let end = Math.min(chunkChars, buffer.length);
      if (end < buffer.length && /[\uD800-\uDBFF]/.test(buffer[end - 1]) && /[\uDC00-\uDFFF]/.test(buffer[end])) end--;
      const text = buffer.slice(0, end); buffer = buffer.slice(end);
      if (!buffer) deadline = 0;
      yield text;
      continue;
    }
    if (failed) throw failure;
    if (done) return;
    pending ??= nextWithSignal(iterator, signal).then(item => ({item}), error => ({error, failed: true}));
    let timer, result;
    try {
      result = buffer ? await Promise.race([pending, new Promise(resolve => {timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now()));})]) : await pending;
    } finally { clearTimeout(timer); }
    if (result === null) continue;
    pending = undefined;
    if (result.failed) {failed = true; failure = result.error; continue;}
    if (result.item.done) {done = true; continue;}
    if (typeof result.item.value !== 'string') {failed = true; failure = new TypeError('Source chunks must be strings'); continue;}
    if (result.item.value) {
      if (!buffer) deadline = Date.now() + flushMs;
      buffer += result.item.value;
    }
  }
}

function nextWithSignal(iterator, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, {once: true});
    Promise.resolve().then(() => {signal.throwIfAborted(); return iterator.next();}).then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
