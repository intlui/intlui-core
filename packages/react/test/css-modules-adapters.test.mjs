import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRuntime} from '../src/runtime.js';
import {compileDil} from '../src/compiler.js';
import {createFixture} from '../../../examples/react-css-modules/fixture.js';

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.children)] : [];
const tick = () => new Promise(resolve => setImmediate(resolve));

test('CSS Modules host controls dispatch typed values and preserve runtime state through protocol data revisions', async () => {
  const server = await createServer({root: fileURLToPath(new URL('../../../', import.meta.url)), configFile: false, envDir: false,
    server: {middlewareMode: true, hmr: false}, appType: 'custom'});
  try {
    const {adapters} = await server.ssrLoadModule('/examples/react-css-modules/adapters.jsx');
    const fixture = createFixture('test'), state = fixture.next(), block = state.blocks[0];
    const messages = [], runtime = createRuntime(message => messages.push(message));
    runtime.load({...compileDil(block.source).payload, appData: block.appData});
    const current = type => nodes(messages.findLast(message => message.type === 'snapshot').tree).find(node => node.type === type);
    const controls = [
      ['checkbox', true, {target: {checked: true}}], ['input', 'Partner project', {target: {value: 'Partner project'}}],
      ['slider', 75, {target: {value: '75'}}], ['select', 'pro', {target: {value: 'pro'}}],
    ];
    for (const [type, expected, event] of controls) {
      const node = current(type), received = [];
      const props = {...node.props, children: node.children, className: 'host-hook', style: {}, 'data-d-component': type,
        onChange(value) {received.push(value); runtime.trigger(node.props.onChange.$callback, [value]);}};
      const element = adapters[type](props);
      const control = ['input', 'select'].includes(type) ? element : React.Children.toArray(element.props.children).find(child => child.type === 'input');
      control.props.onChange(event); await tick();
      assert.deepEqual(received, [expected]);
      assert.equal(current(type).props[type === 'checkbox' ? 'checked' : 'value'], expected);
      const html = renderToStaticMarkup(React.createElement(adapters[type], {...props, disabled: true}));
      assert.match(html, /disabled/); assert.match(html, /host-hook/);
      assert.match(html, /_control_/); // Actual Vite CSS Modules transformation.
      if (type === 'select') assert.match(html, /value="soon" disabled/);
    }
    const callbacks = controls.map(([type]) => current(type).props.onChange.$callback);
    let updated;
    do {updated = fixture.next(); runtime.updateData(updated.blocks[0].appData);} while (!updated.terminal);
    for (const [index, [type, expected]] of controls.entries()) {
      assert.equal(current(type).props[type === 'checkbox' ? 'checked' : 'value'], expected);
      assert.equal(current(type).props.onChange.$callback, callbacks[index]);
    }
    assert.equal(updated.blocks[0].id, block.id); assert.equal(updated.blocks[0].source, block.source);
    assert.equal(updated.blocks[0].revision, 6); assert.equal(updated.status, 'complete');
    assert.equal(messages.filter(message => message.type === 'error').length, 0);
    // A new response intentionally starts a fresh runtime identity.
    runtime.load({...compileDil(block.source).payload, appData: block.appData});
    assert.equal(current('checkbox').props.checked, false); assert.equal(current('input').props.value, '');
  } finally {await server.close();}
});
