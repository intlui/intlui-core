import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRendererProfiles, DilSource, IntluiAnswer} from '@intlui/react';
import {Tree} from '@intlui/react/primitives';
import {UI_PROFILE} from '@intlui/protocol';
import {profile, components, compile, validateData, createCounterState} from '../../../examples/profiles/counter.js';
const Renderer = ({artifact, appData}) => React.createElement(Tree, {node:createCounterState().tree(artifact.value, appData), dispatch() {}});
const entry = {profile, components, compile, validateData, Renderer};
const source = '{"kind":"counter","label":"Sample"}';

test('renderer registry selects exact versions and rejects invalid adapters and requirements', () => {
  const profiles = createRendererProfiles([entry]);
  assert.deepEqual(profiles.capabilities(profile).profile, profile);
  assert.throws(() => profiles.compile({...profile,version:'2'}, source), /Unsupported/);
  assert.throws(() => profiles.compile(profile, '<text>UI</text>'));
  assert.throws(() => createRendererProfiles([entry,entry]), /Duplicate/);
  assert.throws(() => createRendererProfiles([{...entry,profile:UI_PROFILE}]), /Duplicate/);
  assert.throws(() => profiles.capabilities(profile,{components:['slider']}), /Unsupported/);
  assert.throws(() => createRendererProfiles([{...entry,compile:async () => ({})}]).compile(profile,source), /synchronous/);
  assert.throws(() => createRendererProfiles([{...entry,compile:() => ({artifact:{},requiredComponents:['slider']})}]).compile(profile,source), /Unsupported/);
  const {compile:compileSelected} = profiles;
  assert.deepEqual(compileSelected(profile,source).artifact.profile,profile);
  assert.doesNotThrow(() => profiles.compile(UI_PROFILE,'<math>x</math>'));
});

test('public React entry renders custom artifacts and refuses invalid data or foreign blocks', () => {
  const profiles = createRendererProfiles([entry]);
  const draw = props => renderToStaticMarkup(React.createElement(DilSource,{source, profile, profiles, appData:{count:1},...props}));
  assert.match(draw(), /Sample: 1; local clicks: 0/);
  assert.match(draw({appData:{count:-1}}), /role="alert"/);
  assert.match(draw({profile:{...profile,version:'2'}}), /Unsupported renderer profile/);
  const block = {id:'counter',format:'dil',source,appData:{count:1},profile,requiredComponents:components,revision:1};
  const state = {projectId:'p',conversationId:'c',turnId:'t',text:'Facts',blocks:[block],errors:[],status:'complete',terminal:true,capabilities:profiles.capabilities(profile)};
  assert.match(renderToStaticMarkup(React.createElement(IntluiAnswer,{state,profiles})), /Sample: 1/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(IntluiAnswer,{state:{...state,capabilities:profiles.capabilities(UI_PROFILE)},profiles})), /Sample: 1/);
});

test('custom state owner reuses shared primitives and preserves interaction across data revisions', () => {
  const {artifact} = compile(source), runtime = createCounterState();
  const first = runtime.tree(artifact,{count:1});
  runtime.increment(); runtime.increment();
  const second = runtime.tree(artifact,{count:2});
  assert.equal(first[1].props.onClick.$callback,second[1].props.onClick.$callback);
  assert.match(renderToStaticMarkup(React.createElement(Tree,{node:second,dispatch(){}})), /Sample: 2; local clicks: 2/);
  assert.throws(() => runtime.tree(artifact,{count:-1}), /Invalid/);
  assert.match(runtime.tree(artifact,{count:3})[0].children[0], /local clicks: 2/);
});
