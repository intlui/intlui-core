import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDil } from '@intlui/react/compiler';

test('compiler reports emitted Markdown components and normalizes helper components', () => {
  const result = compileDil('# Summary\n\n| Item | Value |\n| --- | --- |\n| A | 1 |\n\n<Chart content={{data:[]}}/><CodeBlock>const x = 1;</CodeBlock>');
  assert.deepEqual(result.requiredComponents, ['chart', 'code', 'table', 'table-cell', 'table-row', 'title']);
  assert.equal(compileDil('<text>Hello</text>').requiredComponents.includes('chart'), false);
});

test('compiler includes conditional components even when initial data hides them', () => {
  const { requiredComponents } = compileDil('{@body const data=DIL.useAppData()}\n{#if data.show}<checkbox checked={false}/>{:else}<text>Waiting</text>{/if}');
  assert.deepEqual(requiredComponents, ['checkbox', 'text']);
});
