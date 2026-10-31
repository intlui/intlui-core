import {createTextSource} from './text-source.js';

/** Ordered utterances: provisional revisions stay local; finalized text is immutable. */
export function createTranscriptSource({signal, maxSegmentChars = 4096, separator = '\n', ...limits} = {}) {
  if (!Number.isSafeInteger(maxSegmentChars) || maxSegmentChars < 1 || typeof separator !== 'string' || separator.length > 16) throw TypeError('Invalid transcript options');
  const source = createTextSource({signal, ...limits});
  let sequence = 1, pending = '', interim = false, last, committed = false;
  const clear = () => {pending = ''; interim = false; last = undefined; signal?.removeEventListener('abort', clear);};
  signal?.addEventListener('abort', clear, {once: true});
  if (signal?.aborted) clear();
  const fail = error => {source.fail(error); clear();};
  return {
    get closed() {return source.closed;},
    get bufferedChars() {return source.bufferedChars;},
    get pendingText() {return pending;},
    get nextSequence() {return sequence;},
    push(event) {
      if (source.closed) throw Error('Transcript source is closed');
      try {
        if (!event || typeof event !== 'object' || Array.isArray(event) || Object.keys(event).some(key => !['sequence', 'text', 'final'].includes(key)) ||
          !Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string' || typeof event.final !== 'boolean') throw TypeError('Invalid transcript event');
        if (event.text.length > maxSegmentChars) throw RangeError('Transcript segment limit exceeded');
        if (event.sequence !== sequence) {
          if (last && event.sequence === last.sequence && event.final && event.text === last.text) return {committed: false, replayed: true, nextSequence: sequence};
          throw Error('Transcript sequence or finalized text conflict');
        }
        if (!event.final) {pending = event.text; interim = true; return {committed: false, replayed: false, nextSequence: sequence};}
        if (event.text) source.push((committed ? separator : '') + event.text);
        committed ||= !!event.text;
        last = {sequence, text: event.text}; sequence++; pending = ''; interim = false;
        return {committed: !!event.text, replayed: false, nextSequence: sequence};
      } catch (error) {fail(error); throw error;}
    },
    end() {
      if (source.closed) return;
      if (interim) {const error = Error('Transcript ended before its pending segment was finalized'); fail(error); throw error;}
      source.end(); clear();
    },
    fail,
    [Symbol.asyncIterator]() {
      const iterator = source[Symbol.asyncIterator]();
      return {next: () => iterator.next(), return: () => {clear(); return iterator.return();}};
    },
  };
}
