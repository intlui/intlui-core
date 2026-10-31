import test from 'node:test';
import assert from 'node:assert/strict';
import {createTranscriptSource} from '../src/index.js';

test('provisional corrections stay local and finalized utterances stream once without waiting for conversation end', async () => {
  const source = createTranscriptSource(), reader = source[Symbol.asyncIterator]();
  let delivered = false;
  const first = reader.next().then(value => {delivered = true; return value;});
  source.push({sequence: 1, text: 'Buy five', final: false});
  source.push({sequence: 1, text: 'Buy four', final: false});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(delivered, false); assert.equal(source.bufferedChars, 0); assert.equal(source.pendingText, 'Buy four');
  const finalized = {sequence: 1, text: 'Buy four items.', final: true};
  assert.equal(source.push(finalized).committed, true);
  assert.equal((await first).value, finalized.text); assert.equal(source.closed, false); assert.equal(source.pendingText, '');
  source.push({sequence: 2, text: 'Delivery', final: false});
  assert.equal(source.push(finalized).replayed, true); assert.equal(source.pendingText, 'Delivery');
  source.push({sequence: 2, text: 'Delivery tomorrow.', final: true});
  source.end(); assert.equal((await reader.next()).value, '\nDelivery tomorrow.'); assert.equal((await reader.next()).done, true);
});

test('finalized text conflicts, sequence gaps and invalid payloads fail without silently rewriting accepted text', async () => {
  for (const event of [{sequence: 1, text: 'Changed', final: true}, {sequence: 3, text: 'Gap', final: true},
    {sequence: 2, text: 'Invalid', final: 'yes'}, {sequence: 2, text: 'Invalid', final: true, audio: 'not supported'}]) {
    const source = createTranscriptSource(), reader = source[Symbol.asyncIterator]();
    source.push({sequence: 1, text: 'Accepted', final: true});
    assert.throws(() => source.push(event));
    assert.equal((await reader.next()).value, 'Accepted'); await assert.rejects(reader.next());
    assert.equal(source.closed, true); assert.equal(source.pendingText, '');
  }
});

test('pending finalization is explicit, including empty utterances and termination', async () => {
  const source = createTranscriptSource(), reader = source[Symbol.asyncIterator]();
  source.push({sequence: 1, text: 'Discard this guess', final: false});
  assert.equal(source.push({sequence: 1, text: '', final: true}).committed, false);
  source.push({sequence: 2, text: 'Only confirmed text', final: true}); source.end();
  assert.equal((await reader.next()).value, 'Only confirmed text'); assert.equal((await reader.next()).done, true);
  const unfinished = createTranscriptSource(), pending = unfinished[Symbol.asyncIterator]().next();
  unfinished.push({sequence: 1, text: 'Unconfirmed', final: false});
  assert.throws(() => unfinished.end(), /finalized/); await assert.rejects(pending, /finalized/);
});

test('limits, cancellation and consumer return bound transcript buffers and discard provisional state', async () => {
  const limited = createTranscriptSource({maxSegmentChars: 3}), read = limited[Symbol.asyncIterator]().next();
  assert.throws(() => limited.push({sequence: 1, text: 'long', final: false}), RangeError); await assert.rejects(read, RangeError);
  const buffered = createTranscriptSource({maxBufferedChars: 3}), reader = buffered[Symbol.asyncIterator]();
  buffered.push({sequence: 1, text: 'abc', final: true});
  assert.throws(() => buffered.push({sequence: 2, text: 'd', final: true}), RangeError);
  assert.equal((await reader.next()).value, 'abc'); await assert.rejects(reader.next(), RangeError);
  const controller = new AbortController(), source = createTranscriptSource({signal: controller.signal});
  const waiting = source[Symbol.asyncIterator]().next(); source.push({sequence: 1, text: 'Private draft', final: false}); controller.abort();
  await assert.rejects(waiting, {name: 'AbortError'}); assert.equal(source.pendingText, '');
  const abandoned = createTranscriptSource(), iterator = abandoned[Symbol.asyncIterator]();
  abandoned.push({sequence: 1, text: 'Draft', final: false}); await iterator.return();
  assert.equal(abandoned.pendingText, ''); assert.equal(abandoned.closed, true);
  assert.throws(() => abandoned.push({sequence: 1, text: 'Late', final: true}), /closed/);
  for (const options of [{maxSegmentChars: 0}, {separator: 'x'.repeat(17)}, {maxBufferedChars: 0}]) assert.throws(() => createTranscriptSource(options));
});
