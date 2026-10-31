import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('chart exposes semantic data and does not plot missing values as zero', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { Chart } = await server.ssrLoadModule('/src/components.jsx');
    const props = { 'aria-label': 'Revenue <report>', xAxis: { dataKey: 'month', label: 'Month' }, series: [{ type: 'line', dataKey: 'value', label: 'Revenue' }],
      data: [0, -2, '3.5', null, '', false, undefined, Infinity].map((value, i) => ({ month: `M${i}`, value })) };
    const html = renderToStaticMarkup(React.createElement(Chart, props));
    assert.match(html, /aria-label="Revenue &lt;report&gt;"/);
    assert.match(html, /<caption>Revenue &lt;report&gt;<\/caption>/);
    assert.match(html, /<th scope="col"[^>]*>Month<\/th>/);
    assert.match(html, /<th scope="row"[^>]*>M0<\/th><td[^>]*>0<\/td>/);
    assert.equal((html.match(/<circle /g) || []).length, 3);
    assert.equal((html.match(/Data unavailable/g) || []).length, 5);
    assert.doesNotMatch(html, /(?:cy|cx)="(?:NaN|Infinity)"/);
    const empty = renderToStaticMarkup(React.createElement(Chart, { ...props, data: [] }));
    assert.match(empty, /No data to display/);
    for (const malformed of [{ data: [null] }, { series: [null] }, { xAxis: null }]) {
      assert.match(renderToStaticMarkup(React.createElement(Chart, { ...props, ...malformed })), /Chart not supported/);
    }
  } finally { await server.close(); }
});

test('reference controls and host adapter share value callback semantics and styling hooks', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { Tree, AdapterContext } = await server.ssrLoadModule('/src/components.jsx');
    const node = { type: 'checkbox', props: { checked: true, disabled: true, onChange: { $callback: 7 } }, children: ['Verify'] };
    const calls = [];
    const draw = components => renderToStaticMarkup(React.createElement(AdapterContext.Provider,
      { value: { components, classNames: { checkbox: 'rounded border-teal-500' } } },
      React.createElement(Tree, { node, dispatch: (...args) => calls.push(args) })));
    const reference = draw({});
    assert.match(reference, /type="checkbox"/); assert.match(reference, /disabled/);
    assert.match(reference, /rounded border-teal-500/); assert.match(reference, /checked/);
    const custom = draw({ checkbox: props => {
      props.onChange(false);
      return React.createElement('span', { 'data-custom': true, className: props.className }, props.children);
    } });
    assert.match(custom, /data-custom/); assert.match(custom, /Verify/);
    assert.deepEqual(calls, [[7, false]]);
  } finally { await server.close(); }
});

test('reference controls preserve explicit accessible names and disabled select options', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { Tree } = await server.ssrLoadModule('/src/components.jsx');
    const draw = (type, props, children = []) => renderToStaticMarkup(React.createElement(Tree, { node: { type, props, children }, dispatch() {} }));
    for (const type of ['checkbox', 'button', 'pressable', 'segmented-control']) {
      const html = draw(type, { 'aria-label': 'Explicit name', options: [] });
      assert.match(html, /aria-label="Explicit name"/);
      if (type === 'checkbox') assert.match(html, /<input[^>]*aria-label="Explicit name"/);
    }
    const namedByContent = draw('checkbox', {}, ['Visible label']);
    assert.match(namedByContent, /Visible label/);
    assert.doesNotMatch(namedByContent, /aria-label=/, 'Do not override an available visible label with a generic name');
    const select = draw('select', { value: 'a', options: [{ value: 'a', label: 'Open' }, { value: 'b', label: 'Closed', disabled: true }] });
    assert.match(select, /<option value="b" disabled="">Closed<\/option>/);
    assert.doesNotMatch(select, /<option value="a"[^>]*disabled/);
  } finally { await server.close(); }
});

test('chart retains host classes and semantic layout styles for supported and unsupported series', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { Tree, AdapterContext } = await server.ssrLoadModule('/src/components.jsx');
    for (const type of ['bar', 'line', 'unsupported']) {
      const node = { type: 'chart', props: { padding: 2, data: [{ month: 'Jan', value: 3 }], xAxis: { dataKey: 'month' }, series: [{ type, dataKey: 'value' }] } };
      const html = renderToStaticMarkup(React.createElement(AdapterContext.Provider,
        { value: { components: {}, classNames: { chart: 'host-chart' } } },
        React.createElement(Tree, { node, dispatch() {} })));
      assert.match(html, /class="intl-chart host-chart"/);
      assert.match(html, /data-d-component="chart"/);
      assert.match(html, /padding:calc\(var\(--intl-space, 4px\) \* 2\)/);
      assert.match(html, type !== 'unsupported' ? /<svg/ : /role="status"/);
      if (type !== 'unsupported') assert.match(html, /<title>Jan .* value: 3<\/title>/);
    }
  } finally { await server.close(); }
});


test('local interruption preserves server state and text without overriding terminal outcomes', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { IntluiAnswer } = await server.ssrLoadModule('/src/IntluiAnswer.jsx');
    const state = Object.freeze({ text: 'Facts already received', blocks: [], errors: [], status: 'receiving', terminal: false });
    const draw = (interruption, value = state) => renderToStaticMarkup(React.createElement(IntluiAnswer, { state: value, interruption }));
    for (const reason of ['cancelled', 'disconnected']) {
      const html = draw(reason);
      assert.match(html, new RegExp(`data-interruption="${reason}"`));
      assert.match(html, /Facts already received/);
      assert.doesNotMatch(html, /role="status">Ricezione/);
      assert.equal(state.status, 'receiving');
      assert.equal(state.terminal, false);
    }
    for (const status of ['complete', 'partial', 'failed', 'cancelled']) {
      const html = draw('disconnected', { ...state, terminal: true, status });
      assert.doesNotMatch(html, /data-interruption/);
      const expected = {complete: 'Response complete', partial: 'Partial response', failed: 'Response failed', cancelled: 'Response cancelled'};
      assert.match(html, new RegExp(`role="status">${expected[status]}`));
    }
    assert.match(draw(undefined), /role="status">Receiving response/);
  } finally { await server.close(); }
});
