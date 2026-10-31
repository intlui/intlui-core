import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDil, parseDil } from '../src/compiler.js';
import { createRuntime } from '../src/runtime.js';
import { blockIdentity } from '../src/identity.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.children)] : [];
const source = '{@body const data=DIL.useAppData()}\n{@body const [done,setDone]=DIL.useState(false)}\n<checkbox checked={done} onChange={setDone}>{data.label}</checkbox>';

test('valid data after a render error recovers state but does not revive old callbacks', async () => {
  const messages = [];
  const runtime = createRuntime(message => messages.push(message));
  runtime.load({ ...compileDil('{@body const data=DIL.useAppData()}\n{@body const [done,setDone]=DIL.useState(false)}\n{@body const label=(()=>{if(data.fail)throw new Error("Expected render failure");return "Working control"})()}\n<checkbox checked={done} onChange={setDone}>{label}</checkbox>').payload, appData: { fail: false } });
  const control = () => nodes(messages.findLast(message => message.type === 'snapshot')?.tree).find(node => node.type === 'checkbox');
  const oldId = control().props.onChange.$callback;
  runtime.trigger(oldId, [true]); await tick();
  runtime.updateData({ fail: true });
  assert.equal(messages.at(-1).message, 'Expected render failure');
  runtime.trigger(oldId, [false]);
  assert.equal(messages.at(-1).message, 'Expired callback');
  runtime.updateData({ fail: false });
  assert.equal(control().props.checked, true);
  assert.notEqual(control().props.onChange.$callback, oldId);
});

test('in-flight callbacks survive data/state renders but expire when their control is removed or reset', async () => {
  const messages = [];
  const runtime = createRuntime(message => messages.push(message));
  const payload = compileDil('{@body const data=DIL.useAppData()}\n{@body const [n,setN]=DIL.useState(0)}\n{#if data.show}<button onClick={()=>setN(v=>v+data.step)}>{n}</button>{/if}').payload;
  const button = () => nodes(messages.findLast(message => message.type === 'snapshot')?.tree).find(node => node.type === 'button');
  runtime.load({ ...payload, appData: { show: true, step: 1 } });
  const originalId = button().props.onClick.$callback;
  runtime.trigger(originalId); await tick();
  runtime.trigger(originalId); await tick();
  assert.equal(button().children.join(''), '2');
  runtime.updateData({ show: true, step: 10 });
  assert.equal(button().props.onClick.$callback, originalId);
  runtime.trigger(originalId); await tick();
  assert.equal(button().children.join(''), '12', 'Stable callback must execute the current closure');
  assert(!messages.some(message => message.type === 'error'));
  runtime.updateData({ show: false, step: 10 });
  runtime.updateData({ show: true, step: 10 });
  assert.notEqual(button().props.onClick.$callback, originalId);
  runtime.trigger(originalId);
  assert.equal(messages.at(-1).message, 'Expired callback');
  const beforeReset = button().props.onClick.$callback;
  runtime.load({ ...payload, appData: { show: true, step: 1 } });
  assert.notEqual(button().props.onClick.$callback, beforeReset);
  runtime.trigger(beforeReset);
  assert.equal(messages.at(-1).message, 'Expired callback');
});

test('a no-op controlled callback emits an authoritative snapshot to settle local input', async () => {
  const messages = [];
  const runtime = createRuntime(message => messages.push(message));
  runtime.load(compileDil('<input value="fixed" onChange={()=>{}}/>').payload);
  const input = () => nodes(messages.findLast(message => message.type === 'snapshot')?.tree).find(node => node.type === 'input');
  const before = messages.filter(message => message.type === 'snapshot').length;
  runtime.trigger(input().props.onChange.$callback, ['ignored']); await tick();
  assert.equal(input().props.value, 'fixed');
  assert.equal(messages.filter(message => message.type === 'snapshot').length, before + 1);
});

test('new source is parsed as DIL and JavaScript AST without executing it', () => {
  const ast = parseDil('{@body const n=2}<text>{n+3}</text>');
  assert.equal(ast.children[0].program.body[0].type, 'VariableDeclaration');
  assert.equal(ast.children[1].children[0].expression.type, 'BinaryExpression');
  assert.doesNotThrow(() => compileDil('{@body const n=(()=>{throw Error("must not run")})()}<text>{n}</text>'));
  assert.throws(() => compileDil('<text>{unfinished</text>'));
});

test('same runtime receives data updates without clearing a selected checkbox', async () => {
  const messages = [];
  const runtime = createRuntime(message => messages.push(message));
  runtime.load({ ...compileDil(source).payload, appData: { label: 'First' } });
  const checkbox = () => nodes(messages.findLast(message => message.type === 'snapshot')?.tree).find(node => node.type === 'checkbox');
  assert.equal(checkbox().props.checked, false);
  runtime.trigger(checkbox().props.onChange.$callback, [true]); await tick();
  assert.equal(checkbox().props.checked, true);
  runtime.updateData({ label: 'Updated' }); await tick();
  assert.equal(checkbox().props.checked, true);
  assert.equal(checkbox().children.join(''), 'Updated');
  runtime.trigger(checkbox().props.onChange.$callback, [false]); await tick();
  assert.equal(checkbox().props.checked, false);
  assert.equal(messages.some(message => message.type === 'error'), false);
});

test('functional updates and keyed local state remain independent', async () => {
  const messages = [];
  const runtime = createRuntime(message => messages.push(message));
  runtime.load(compileDil('{@body const [n,setN]=DIL.useState(2)}<button onClick={()=>setN(v=>v+3)}>{n}</button>').payload);
  const button = () => nodes(messages.findLast(message => message.type === 'snapshot')?.tree).find(node => node.type === 'button');
  runtime.trigger(button().props.onClick.$callback, []); await tick();
  assert.equal(button().children.join(''), '5');
});

test('block identity survives data revisions but resets on turn correction or scope change', () => {
  const state = { projectId: 'a', conversationId: 'b', turnId: 'c', turnRevision: 0 };
  assert.equal(blockIdentity(state, 'tasks'), blockIdentity({ ...state, sequence: 50 }, 'tasks'));
  for (const changes of [{ turnRevision: 1 }, { turnId: 'd' }, { projectId: 'other' }, { conversationId: 'e' }]) {
    assert.notEqual(blockIdentity(state, 'tasks'), blockIdentity({ ...state, ...changes }, 'tasks'));
  }
});
