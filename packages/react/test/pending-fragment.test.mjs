import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDil } from '../src/compiler.js';
import { createRuntime } from '../src/runtime.js';

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.children)] : [];
const tick = () => new Promise(resolve => setImmediate(resolve));

test('conditional pending caption disappears on data update while checkbox selection remains', async () => {
  const messages = [], runtime = createRuntime(message => messages.push(message));
  const source = '{@body const data=DIL.useAppData()}\n{@body const [done,setDone]=DIL.useState(false)}\n<checkbox checked={done} onChange={setDone}>Task</checkbox>\n{#if data.pending}<caption>Incomplete fragment</caption><text>{data.pending}</text>{/if}';
  const tree = () => nodes(messages.findLast(message => message.type === 'snapshot').tree);
  runtime.load({ ...compileDil(source).payload, appData: { pending: 'Unfinished' } });
  assert.equal(tree().filter(node => node.type === 'caption').length, 1);
  runtime.trigger(tree().find(node => node.type === 'checkbox').props.onChange.$callback, [true]); await tick();
  runtime.updateData({ pending: '' }); await tick();
  assert.equal(tree().filter(node => node.type === 'caption').length, 0);
  assert.equal(tree().find(node => node.type === 'checkbox').props.checked, true);
  assert.equal(messages.some(message => message.type === 'error'), false);
});
