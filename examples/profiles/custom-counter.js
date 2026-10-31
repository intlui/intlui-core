import {compile as compileCounter, validateData, createCounterState} from './counter.js';

// Application-owned component vocabulary. No built-in component registration.
export const profile = Object.freeze({id:'example.custom-counter', version:'1'});
export const components = ['example.counter'];
export {validateData, createCounterState};
export function compile(source) {
  return {...compileCounter(source), requiredComponents:[...components]};
}
export const serverProfile = {profile, compile, validateData,
  instructions:'Return source JSON {"kind":"counter","label":"short label"} and appData {"count": nonnegative integer}. This profile provides example.counter. Use data operations for subsequent counts.'};
