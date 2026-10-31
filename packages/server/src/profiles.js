import {UI_PROFILE, profileKey, validateProfile} from '@intlui/protocol';
import {compileUiSource} from './validate-source.js';
import {STREAM_INSTRUCTIONS} from './stream-translator.js';

export function createUiProfile() {
  return Object.freeze({profile:UI_PROFILE, instructions:STREAM_INSTRUCTIONS,
    compile(source) {const result=compileUiSource(source);return {artifact:result.payload,requiredComponents:result.requiredComponents};},
    // The wire validator bounds JSON. Interactive UI expressions run in the browser sandbox.
    validateData() {}
  });
}

export function serverProfiles(entries) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 32) throw TypeError('Register 1..32 server profiles');
  const registry=new Map();
  for (const entry of entries) {
    validateProfile(entry?.profile);
    if (typeof entry.compile !== 'function' || typeof entry.validateData !== 'function' ||
        typeof entry.instructions !== 'string' || !entry.instructions.trim() || entry.instructions.length > 60000) throw TypeError('Invalid server profile adapter');
    const key=profileKey(entry.profile);if(registry.has(key))throw TypeError('Duplicate server profile');
    registry.set(key,Object.freeze({...entry,profile:Object.freeze({...entry.profile})}));
  }
  return registry;
}
