import test from 'node:test';
import assert from 'node:assert/strict';
import {batchSource} from '../src/batch-source.js';
const settings = {signal: new AbortController().signal, chunkChars: 8, flushMs: 5};

test('partial batch flushes while source is still awaiting its next fragment', {timeout: 1000}, async () => {
  let release;
  const gate = new Promise(resolve => {release = resolve;});
  const source = (async function* () {yield 'First'; await gate; yield 'Last';})();
  const iterator = batchSource(source, settings);
  try {
    assert.deepEqual(await iterator.next(), {value: 'First', done: false});
    release();
    assert.deepEqual(await iterator.next(), {value: 'Last', done: false});
    assert.equal((await iterator.next()).done, true);
  } finally {release(); await iterator.return();}
});

test('batching preserves buffered text before reporting a source error and supports immediate mode', async () => {
  const source = (async function* () {yield 'Facts'; throw Error('Upstream failed');})();
  const iterator = batchSource(source, {...settings, flushMs: 1000});
  assert.equal((await iterator.next()).value, 'Facts');
  await assert.rejects(iterator.next(), /Upstream failed/);
  let pulled = 0;
  const immediate = batchSource((async function* () {pulled++; yield 'a'; pulled++; yield 'b';})(), {...settings, flushMs: 0});
  assert.equal((await immediate.next()).value, 'a'); assert.equal(pulled, 1);
  assert.equal((await immediate.next()).value, 'b');
  assert.equal((await immediate.next()).done, true);
});

test('size threshold keeps surrogate pairs together even when fragments split a pair', async () => {
  const pieces = [];
  const source = (async function* () {yield 'A'; yield '\uD83D'; yield '\uDE00B';})();
  for await (const text of batchSource(source, {...settings, chunkChars: 3, flushMs: 1000})) pieces.push(text);
  assert.deepEqual(pieces, ['A\u{1F600}', 'B']);
});
