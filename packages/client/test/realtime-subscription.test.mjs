import test from 'node:test';
import assert from 'node:assert/strict';
import {subscribeOpenAIRealtimeSource} from '../src/index.js';
import {realtimeEvents, realtimeOptions} from '../../../examples/stream-input/realtime-fixture.js';

class Transport extends EventTarget {
  readyState = 'open'; listeners = new Map();
  addEventListener(type, listener, options) {super.addEventListener(type, listener, options); const set = this.listeners.get(type) || new Set(); set.add(listener); this.listeners.set(type, set);}
  removeEventListener(type, listener, options) {super.removeEventListener(type, listener, options); this.listeners.get(type)?.delete(listener);}
  get count() {return [...this.listeners.values()].reduce((total, set) => total + set.size, 0);}
  emit(event) {this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(event)}));}
  close() {assert.fail('Subscription does not own transport.close');}
  send() {assert.fail('Subscription must never send commands');}
}

test('subscription buffers before the HTTP consumer exists, completes and removes only its own listeners', async () => {
  const transport = new Transport(); let hostEvents = 0;
  transport.addEventListener('message', () => hostEvents++);
  const source = subscribeOpenAIRealtimeSource({transport, ...realtimeOptions});
  transport.emit(realtimeEvents[0]); assert.equal(source.bufferedChars, realtimeEvents[0].delta.length);
  const reader = source[Symbol.asyncIterator](); assert.equal((await reader.next()).value, realtimeEvents[0].delta);
  for (const event of realtimeEvents.slice(1)) transport.emit(event);
  assert.equal((await reader.next()).value, realtimeEvents[2].delta); assert.equal((await reader.next()).done, true);
  assert.equal(source.closed, true); assert.equal(transport.count, 1); assert.equal(hostEvents, 5);
  transport.emit(realtimeEvents[0]); assert.equal(hostEvents, 6); assert.equal(transport.readyState, 'open');
});

test('malformed JSON, non-text frames and overlarge messages fail the reader without throwing in event dispatch', async () => {
  for (const [data, maxMessageChars] of [['secret invalid JSON', 100], ['[]', 100], [new ArrayBuffer(8), 100], ['x'.repeat(101), 100]]) {
    const transport = new Transport(), source = subscribeOpenAIRealtimeSource({transport, ...realtimeOptions, maxMessageChars});
    const reading = source[Symbol.asyncIterator]().next();
    assert.doesNotThrow(() => transport.dispatchEvent(new MessageEvent('message', {data})));
    await assert.rejects(reading, error => error.code === 'realtime_transport' && !error.message.includes('secret'));
    assert.equal(transport.count, 0); assert.equal(source.closed, true);
  }
});

test('transport failure and premature close retain already accepted text but never imply successful completion', async () => {
  for (const type of ['error', 'close']) {
    const transport = new Transport(), source = subscribeOpenAIRealtimeSource({transport, ...realtimeOptions});
    transport.emit(realtimeEvents[0]); transport.dispatchEvent(new Event(type));
    const reader = source[Symbol.asyncIterator](); assert.equal((await reader.next()).value, realtimeEvents[0].delta);
    await assert.rejects(reader.next()); assert.equal(transport.count, 0);
  }
});

test('abort, explicit disposal, iterator return and registration races clean up subscriptions', async () => {
  for (const action of ['abort', 'dispose', 'return']) {
    const transport = new Transport(), controller = new AbortController();
    const source = subscribeOpenAIRealtimeSource({transport, ...realtimeOptions, signal: controller.signal}), reader = source[Symbol.asyncIterator]();
    const waiting = reader.next();
    if (action === 'return') {await reader.return(); assert.equal((await waiting).done, true);}
    else {if (action === 'abort') controller.abort(); else source.dispose(); await assert.rejects(waiting, {name: 'AbortError'});}
    assert.equal(transport.count, 0); assert.equal(source.closed, true); source.dispose();
    transport.emit(realtimeEvents[0]); assert.equal(source.bufferedChars, 0);
  }
  const aborted = new Transport();
  const stopped = subscribeOpenAIRealtimeSource({transport: aborted, ...realtimeOptions, signal: AbortSignal.abort()});
  assert.equal(aborted.count, 0); await assert.rejects(stopped[Symbol.asyncIterator]().next(), {name: 'AbortError'});
  const racing = new Transport(), add = racing.addEventListener;
  racing.addEventListener = function (...args) {add.apply(this, args); this.readyState = 'closed';};
  const lost = subscribeOpenAIRealtimeSource({transport: racing, ...realtimeOptions});
  assert.equal(racing.count, 0); await assert.rejects(lost[Symbol.asyncIterator]().next(), {code: 'realtime_transport'});
});
