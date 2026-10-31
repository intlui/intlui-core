import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {IntluiProvider, DilSource, IntluiAnswer, turnStatusLabel} from '@intlui/react';

test('translation notices explain partial UI without hiding source failures or changing protocol state', () => {
  const errors = Object.freeze([
    Object.freeze({code: 'translation_limit', message: 'Raw budget message'}),
    Object.freeze({code: 'translation_failed', message: 'Raw validation message'}),
  ]);
  const state = Object.freeze({text: 'Original <facts>', blocks: [], errors, status: 'partial', terminal: true});
  const draw = (value = state, locale = 'en', interruption) => renderToStaticMarkup(
    React.createElement(IntluiAnswer, {state: value, locale, interruption}));
  const fallback = draw();
  assert.match(fallback, /role="status">Partial interface/);
  assert.match(fallback, /Translation limit reached/);
  assert.match(fallback, /Some interface updates/);
  assert.match(fallback, /Original &lt;facts&gt;/);
  assert.doesNotMatch(fallback, /Raw budget|Raw validation|Response complete/);
  const en = draw(state, 'en');
  assert.match(en, /role="status">Partial interface/);
  assert.match(en, /Translation limit reached/);
  assert.match(en, /Some interface updates/);
  for (const status of ['receiving', 'translating', 'failed', 'cancelled', 'complete']) {
    assert.ok(draw({...state, status, terminal: !['receiving', 'translating'].includes(status)}, 'en')
      .includes(`<p role="status">${turnStatusLabel(status, 'en')}</p>`));
  }
  for (const code of ['source_failed', 'toString']) {
    const html = draw({...state, errors: [...errors, {code, message: '<Source unavailable>'}]});
    assert.match(html, /role="status">Partial response/);
    assert.match(html, /&lt;Source unavailable&gt;/);
  }
  assert.match(draw({...state, errors: []}), /role="status">Partial response/);
  assert.match(draw({...state, status: 'receiving', terminal: false}, 'en', 'disconnected'), /role="status">Connection interrupted/);
  assert.equal(state.errors, errors);
  assert.equal(state.status, 'partial');
  assert.equal(errors[0].message, 'Raw budget message');
});

test('English status labels preserve protocol codes and terminal outcome takes precedence over local interruption', () => {
  for (const locale of ['fr', 'en']) {
    const labels = new Set();
    for (const status of ['receiving', 'translating', 'complete', 'partial', 'cancelled', 'failed']) {
      const state = {text: 'Original', blocks: [], errors: [], status, terminal: !['receiving', 'translating'].includes(status)};
      const label = turnStatusLabel(status, locale);
      labels.add(label);
      const html = renderToStaticMarkup(React.createElement(IntluiAnswer, {state, locale, interruption: state.terminal ? 'disconnected' : undefined}));
      assert.ok(html.includes(`<p role="status">${label}</p>`));
      assert.ok(html.includes(`data-turn-status="${status}"`));
      assert.equal(state.status, status);
    }
    assert.equal(labels.size, 6);
    assert.equal(labels.has(turnStatusLabel('unknown', locale)), false);
    assert.equal(turnStatusLabel('toString', locale), turnStatusLabel('unknown', locale));
  }
});

test('default UI labels are English and inherited object keys cannot select a message catalog', () => {
  const state={text:'Unicode content: ☕ 🚀',blocks:[],errors:[],status:'receiving',terminal:false};
  const html=renderToStaticMarkup(React.createElement(IntluiAnswer,{state}));
  assert.match(html,/lang="en"/);assert.match(html,/Receiving response/);
  assert.match(html,/Unicode content: ☕ 🚀/);
  assert.equal(turnStatusLabel('complete','toString'),'Response complete.');
  assert.equal(turnStatusLabel('complete','constructor'),'Response complete.');
});

test('English widget notices inherit locale without translating source text; explicit locale overrides it', () => {
  const state = {text: 'Unchanged original text', blocks: [], errors: [], status: 'receiving', terminal: false};
  const html = renderToStaticMarkup(React.createElement(IntluiProvider, {locale: 'en'},
    React.createElement(IntluiAnswer, {state, interruption: 'disconnected'}),
    React.createElement(DilSource, {source: '<text>Hello</text>'}),
    React.createElement(IntluiAnswer, {state, interruption: 'cancelled', locale: 'fr'})));
  assert.match(html, /aria-label="Original text"/);
  assert.match(html, /Connection interrupted/);
  assert.match(html, /Loading interface/);
  assert.match(html, /Response interrupted/);
  assert.equal(html.split('Unchanged original text').length - 1, 2);
  assert.match(html, /lang="en"/);
  assert.match(html, /lang="fr"/);
  assert.equal(state.status, 'receiving');
});

test('public provider supplies theme to renderers and local appearance wins without leaking to siblings', () => {
  const source = '<text>Hello</text>';
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(IntluiProvider, {theme: 'dark'},
      React.createElement(DilSource, {source}),
      React.createElement(DilSource, {source, theme: 'light'})),
    React.createElement(DilSource, {source})));
  assert.deepEqual([...html.matchAll(/data-theme="(.*?)"/g)].map(match => match[1]), ['dark', 'light', 'light']);
});

test('nested appearance merges by semantic name and supports removing inherited classes or adapters', async () => {
  const server = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
  try {
    const {IntluiProvider: Provider, useAppearance} = await server.ssrLoadModule('/src/IntluiProvider.jsx');
    const Checkbox = () => null, Button = () => null;
    const components = {checkbox: Checkbox}, classNames = {checkbox: 'host-check', button: 'host-button'};
    let observed;
    function Probe() {observed = useAppearance({components: {checkbox: undefined}, classNames: {button: ''}}); return null;}
    renderToStaticMarkup(React.createElement(Provider, {theme: 'dark', components, classNames},
      React.createElement(Provider, {components: {button: Button}, classNames: {input: 'nested-input'}}, React.createElement(Probe))));
    assert.equal(observed.theme, 'dark');
    assert.equal(observed.components.checkbox, undefined);
    assert.equal(observed.components.button, Button);
    assert.deepEqual(observed.classNames, {checkbox: 'host-check', button: '', input: 'nested-input'});
    assert.deepEqual(components, {checkbox: Checkbox});
    assert.deepEqual(classNames, {checkbox: 'host-check', button: 'host-button'});
  } finally {await server.close();}
});

test('reference controls use English fallbacks while explicit labels and data remain unchanged', async () => {
  const server = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
  try {
    const {AdapterContext, Tree} = await server.ssrLoadModule('/src/components.jsx');
    const node = [
      {type: 'input', props: {value: ''}},
      {type: 'slider', props: {value: 1}},
      {type: 'select', props: {options: []}},
      {type: 'segmented-control', props: {options: []}},
      {type: 'input', props: {'aria-label': 'Chosen name', value: ''}},
      {type: 'chart', props: {data: [{x: 'January', value: null}], xAxis: {dataKey: 'x'}, series: [{type: 'bar', dataKey: 'value', label: 'Revenue'}]}},
      {type: 'chart', props: {data: [], series: []}},
      {type: 'chart', props: {series: [{type: 'unsupported'}]}},
      {type: 'math', props: {value: 'x+y'}},
      {type: 'unknown', children: 'Original'},
    ];
    const render = locale => renderToStaticMarkup(React.createElement(AdapterContext.Provider,
      {value: {locale, components: {}, classNames: {}}}, React.createElement(Tree, {node, dispatch() {}})));
    const html = render('en');
    for (const label of ['Text', 'Value', 'Selection', 'Options', 'Chosen name']) assert.ok(html.includes(`aria-label="${label}"`));
    for (const label of ['Chart data', 'Data unavailable', 'No data to display.', 'Chart not supported', 'LaTeX formula', 'Unsupported component', 'January', 'Revenue', 'Original']) assert.ok(html.includes(label), label);
    assert.match(render('fr'), /Data unavailable/);
    assert.equal(node[4].props['aria-label'], 'Chosen name');
  } finally {await server.close();}
});
