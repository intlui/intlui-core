import {createTextSource} from './text-source.js';

const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const index = value => Number.isSafeInteger(value) && value >= 0;
const invalid = () => Object.assign(Error('Invalid or incomplete Realtime transcript events.'), {code: 'realtime_protocol'});
const deltaType = 'response.output_audio_transcript.delta';
const doneType = 'response.output_audio_transcript.done';

/** One explicitly selected assistant audio content part, from an already authorized session. */
export function createOpenAIRealtimeSource({responseId, itemId, outputIndex = 0, contentIndex = 0,
  signal, maxTextChars = 30000, maxEvents = 4096, ...limits} = {}) {
  if (!identifier(responseId) || !identifier(itemId) || !index(outputIndex) || !index(contentIndex) ||
    ![maxTextChars, maxEvents].every(value => Number.isSafeInteger(value) && value > 0)) throw TypeError('Invalid Realtime source options');
  const source = createTextSource({signal, ...limits}), seen = new Map();
  let text = '', transcriptDone = false;
  const clear = () => {text = ''; seen.clear(); signal?.removeEventListener('abort', clear);};
  signal?.addEventListener('abort', clear, {once: true}); if (signal?.aborted) clear();
  const fail = error => {source.fail(error); clear();};
  function remember(event, fingerprint) {
    if (!identifier(event.event_id)) throw invalid();
    if (seen.has(event.event_id)) {
      if (seen.get(event.event_id) !== fingerprint) throw invalid();
      return false;
    }
    if (seen.size >= maxEvents) throw RangeError('Realtime event limit exceeded');
    seen.set(event.event_id, fingerprint); return true;
  }
  return {
    get closed() {return source.closed;},
    get bufferedChars() {return source.bufferedChars;},
    push(event) {
      if (source.closed) throw Error('Realtime source is closed');
      if (![deltaType, doneType, 'response.done'].includes(event?.type)) return false;
      try {
        if (event.type === 'response.done') {
          if (!identifier(event.response?.id)) throw invalid();
          if (event.response.id !== responseId) return false;
          if (!identifier(event.event_id)) throw invalid();
          if (event.response.status !== 'completed') throw Object.assign(Error('Realtime response did not complete successfully.'), {code: 'realtime_incomplete'});
          const item = event.response.output?.[outputIndex], part = item?.content?.[contentIndex];
          if (!transcriptDone || item?.id !== itemId || item?.type !== 'message' || item?.role !== 'assistant' ||
            (item.status !== undefined && item.status !== 'completed') || part?.type !== 'output_audio' || part.transcript !== text) throw invalid();
          if (!remember(event, JSON.stringify([event.type, text]))) return false;
          source.end(); clear(); return true;
        }
        if (!identifier(event.response_id)) throw invalid();
        if (event.response_id !== responseId) return false;
        if (!identifier(event.item_id) || !index(event.output_index) || !index(event.content_index)) throw invalid();
        if (event.item_id !== itemId || event.output_index !== outputIndex || event.content_index !== contentIndex) return false;
        const value = event.type === deltaType ? event.delta : event.transcript;
        if (typeof value !== 'string' || value.length > maxTextChars) throw invalid();
        if (!remember(event, JSON.stringify([event.type, value]))) return false;
        if (event.type === deltaType) {
          if (transcriptDone) throw invalid();
          if (text.length + value.length > maxTextChars) throw RangeError('Realtime text limit exceeded');
          source.push(value); text += value;
        } else {
          if (transcriptDone || value !== text) throw invalid();
          transcriptDone = true;
        }
        return true;
      } catch (error) {fail(error); throw error;}
    },
    /** Transport closure is not completion: response.done must have been observed. */
    end() {if (!source.closed) {const error = invalid(); fail(error); throw error;}},
    fail,
    [Symbol.asyncIterator]() {
      const iterator = source[Symbol.asyncIterator]();
      return {next: () => iterator.next(), return: () => {clear(); return iterator.return();}};
    },
  };
}
