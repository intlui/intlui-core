import test from 'node:test';
import assert from 'node:assert/strict';
import {createTextSource} from '../src/index.js';

test('event text source wakes pending reads, preserves chunks and drains before end', async () => {
  const source = createTextSource(), iterator = source[Symbol.asyncIterator]();
  const pending = iterator.next(); source.push('caff\u00e8');
  assert.deepEqual(await pending, {value: 'caff\u00e8', done: false});
  source.push('\ud83d'); source.push('\ude00'); source.end(); source.end();
  assert.equal(source.bufferedChars, 2);
  assert.equal((await iterator.next()).value + (await iterator.next()).value, '\ud83d\ude00');
  assert.equal((await iterator.next()).done, true);
  assert.equal(source.bufferedChars, 0);
  assert.throws(() => source.push('late'), /closed/);
  assert.throws(() => source[Symbol.asyncIterator](), /one consumer/);
});

test('overflow fails both producer and consumer after draining accepted text, never silently dropping', async () => {
  for (const limits of [{maxBufferedChars: 3}, {maxBufferedChunks: 1}]) {
    const source = createTextSource(limits), iterator = source[Symbol.asyncIterator]();
    source.push('abc'); source.push('');
    assert.throws(() => source.push('d'), RangeError);
    assert.equal(source.closed, true);
    assert.equal((await iterator.next()).value, 'abc');
    await assert.rejects(iterator.next(), RangeError);
  }
});

test('abort and iterator return release stalled consumers and discard buffered text', async () => {
  const controller = new AbortController();
  const source = createTextSource({signal: controller.signal}), iterator = source[Symbol.asyncIterator]();
  source.push('discard'); controller.abort();
  await assert.rejects(iterator.next(), {name: 'AbortError'});
  assert.equal(source.bufferedChars, 0);
  const other = createTextSource(), reader = other[Symbol.asyncIterator]();
  const pending = reader.next(); await reader.return();
  assert.equal((await pending).done, true);
  assert.equal(other.closed, true);
  const stopped = createTextSource({signal: AbortSignal.abort()});
  await assert.rejects(stopped[Symbol.asyncIterator]().next(), {name: 'AbortError'});
});

test('producer failure wakes a waiting reader and concurrent reads are rejected', async () => {
  const source = createTextSource(), iterator = source[Symbol.asyncIterator]();
  const pending = iterator.next();
  await assert.rejects(iterator.next(), /Concurrent/);
  source.fail(new Error('upstream disconnected'));
  await assert.rejects(pending, /upstream disconnected/);
  for (const limits of [{maxBufferedChars: 0}, {maxBufferedChunks: NaN}]) assert.throws(() => createTextSource(limits));
});
