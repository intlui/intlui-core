import React from 'react';
import {UI_PROFILE, profileKey, validateCapabilities} from '@intlui/protocol';
import {compileDil} from './compiler.js';
import {DilRenderer} from './DilRenderer.jsx';
import {createRendererCapabilities} from './capabilities.js';

function UiRenderer({artifact, ...props}) {return <DilRenderer artifact={artifact.value} {...props}/>;}
const ui={profile:UI_PROFILE, components:createRendererCapabilities().components, Renderer:UiRenderer,
  compile(source){const result=compileDil(source);return {artifact:result.payload,requiredComponents:result.requiredComponents,diagnostics:result.diagnostics};},
  validateData() {}
};

/** Entries are trusted application modules, never modules supplied by generated content. */
export function createRendererProfiles(entries = []) {
  if(!Array.isArray(entries) || entries.length > 31)throw TypeError('Invalid renderer profiles');
  const registry=new Map();
  for(const entry of [ui,...entries]) {
    const key=profileKey(entry?.profile);
    if(registry.has(key))throw TypeError('Duplicate renderer profile');
    if(typeof entry.compile !== 'function' || typeof entry.validateData !== 'function' || typeof entry.Renderer !== 'function')throw TypeError('Invalid renderer profile adapter');
    validateCapabilities({surface:'react',formats:['dil'],components:entry.components,profile:entry.profile});
    registry.set(key,Object.freeze({...entry,profile:Object.freeze({...entry.profile}),components:Object.freeze([...entry.components])}));
  }
  const resolve=profile=>{const entry=registry.get(profileKey(profile));if(!entry)throw TypeError('Unsupported renderer profile');return entry;};
  const capabilities=(profile,{surface='react',components}={}) => {
      const entry=resolve(profile), selected=components ?? entry.components;
      if(!Array.isArray(selected) || selected.some(name=>!entry.components.includes(name)))throw TypeError('Unsupported profile components');
      return validateCapabilities({surface,formats:selected.length?['dil']:[],components:[...selected],profile:{...entry.profile}});
    };
  return Object.freeze({
    resolve,
    capabilities,
    compile(profile,source) {
      if(typeof source !== 'string' || !source.trim() || source.length > 200000)throw TypeError('Invalid profile source');
      const entry=resolve(profile), result=entry.compile(source);
      if(!result || typeof result.then === 'function' || !Object.hasOwn(result,'artifact') || !Array.isArray(result.requiredComponents))throw TypeError('Invalid synchronous renderer compilation');
      // Direct UI rendering retains its visible unsupported-tag diagnostics.
      // Wire blocks are independently restricted by negotiated capabilities.
      if(profileKey(profile) !== profileKey(UI_PROFILE))capabilities(profile,{components:result.requiredComponents});
      return {artifact:Object.freeze({profile:entry.profile,value:result.artifact}),diagnostics:result.diagnostics ?? [],Renderer:entry.Renderer,adapter:entry};
    }
  });
}

export const defaultRendererProfiles=createRendererProfiles();
