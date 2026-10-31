import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenAIRealtimeSource} from '../src/index.js';

const scope = {response_id: 'response', item_id: 'item', output_index: 0, content_index: 0};
const delta = (text, id = 'delta') => ({...scope, type: 'response.output_audio_transcript.delta', event_id: id, delta: text});
const transcript = text => ({...scope, type: 'response.output_audio_transcript.done', event_id: 'transcript', transcript: text});
const complete = (text, status = 'completed') => ({type: 'response.done', event_id: 'final', response: {id: 'response', status,
  output: [{id: 'item', type: 'message', role: 'assistant', content: [{type: 'output_audio', transcript: text}]}]}});
const create = options => createOpenAIRealtimeSource({responseId: 'response', itemId: 'item', ...options});

test('Realtime output transcript deltas stream immediately and completion waits for successful response status', async () => {
  const source = create(), reader = source[Symbol.asyncIterator]();
  const first = reader.next(); assert.equal(source.push(delta('First. ')), true);
  assert.equal((await first).value, 'First. '); assert.equal(source.closed, false);
  assert.equal(source.push(delta('First. ')), false);
  source.push(delta('Second.', 'second')); source.push(transcript('First. Second.'));
  assert.equal(source.closed, false, 'Transcript done alone is not success');
  source.push(complete('First. Second.')); assert.equal(source.closed, true);
  assert.equal((await reader.next()).value, 'Second.'); assert.equal((await reader.next()).done, true);
});

test('other responses, items, content parts and audio bytes never enter the selected text stream', async () => {
  const source = create(), reader = source[Symbol.asyncIterator]();
  for (const event of [{...delta('private'), response_id: 'other'}, {...delta('private'), item_id: 'other'},
    {...delta('private'), content_index: 1}, {type: 'response.output_audio.delta', delta: 'audio'}, {type: 'input_audio_buffer.committed'}]) {
    assert.equal(source.push(event), false);
  }
  assert.equal(source.bufferedChars, 0);
  source.push(delta('Selected')); source.push(transcript('Selected')); source.push(complete('Selected'));
  assert.equal((await reader.next()).value, 'Selected'); assert.equal((await reader.next()).done, true);
});

test('cancelled, failed and incomplete responses cannot become successful after transcript done', async () => {
  for (const status of ['cancelled', 'failed', 'incomplete', 'in_progress']) {
    const source = create(), reader = source[Symbol.asyncIterator]();
    source.push(delta('Partial')); source.push(transcript('Partial'));
    assert.throws(() => source.push(complete('Partial', status)), {code: 'realtime_incomplete'});
    assert.equal((await reader.next()).value, 'Partial'); await assert.rejects(reader.next(), {code: 'realtime_incomplete'});
  }
});

test('conflicting replay, missing deltas, late deltas and transport closure fail without inventing success', async () => {
  for (const action of [source => source.push(delta('Changed')), source => source.push(transcript('Mismatched')),
    source => source.push(complete('Text')), source => source.end(), source => {source.push(transcript('Text')); source.push(delta('Late', 'late'));},
    source => {source.push(transcript('Text')); source.push(complete('Changed'));},
    source => {source.push(transcript('Text')); source.push({...complete('Text'), event_id: 'delta'});}]) {
    const source = create(), reader = source[Symbol.asyncIterator](); source.push(delta('Text'));
    assert.throws(() => action(source), {code: 'realtime_protocol'});
    assert.equal((await reader.next()).value, 'Text'); await assert.rejects(reader.next(), {code: 'realtime_protocol'});
  }
});

test('event, transcript and queue limits fail closed; local cancellation discards buffered work', async () => {
  for (const options of [{maxEvents: 1}, {maxTextChars: 4}, {maxBufferedChars: 4}]) {
    const source = create(options), reader = source[Symbol.asyncIterator](); source.push(delta('Text'));
    assert.throws(() => source.push(delta('More', 'more')), RangeError);
    assert.equal((await reader.next()).value, 'Text'); await assert.rejects(reader.next(), RangeError);
  }
  const controller = new AbortController(), source = create({signal: controller.signal}), reader = source[Symbol.asyncIterator]();
  source.push(delta('Discard')); controller.abort(); await assert.rejects(reader.next(), {name: 'AbortError'});
  assert.equal(source.bufferedChars, 0); assert.throws(() => source.push(delta('Late')), /closed/);
  const other = create(), iterator = other[Symbol.asyncIterator](), waiting = iterator.next();
  await iterator.return(); assert.equal((await waiting).done, true); assert.equal(other.closed, true);
  assert.throws(() => createOpenAIRealtimeSource({responseId: 'response'}));
});
