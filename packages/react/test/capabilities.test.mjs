import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {validateCapabilities} from '@intlui/protocol';
import {createRendererCapabilities} from '@intlui/react/capabilities';

test('renderer profiles are independent, validated subsets and accept host identifiers without advertising unsupported components', () => {
  const first = createRendererCapabilities();
  validateCapabilities(first);
  assert(!first.components.includes('math'));
  first.components.length = 0; first.formats.length = 0;
  assert(createRendererCapabilities().components.includes('checkbox'));
  const selected = ['text', 'checkbox'];
  const widget = createRendererCapabilities({surface: 'widget', components: selected});
  selected.push('math');
  assert.deepEqual(widget, {surface: 'widget', formats: ['dil'], components: ['text', 'checkbox']});
  validateCapabilities(widget);
  assert.deepEqual(createRendererCapabilities({components: []}).formats, []);
  for (const components of [['math'], ['unknown'], ['text', 'text'], 'text', new Array(1)]) assert.throws(() => createRendererCapabilities({components}), TypeError);
  assert.equal(createRendererCapabilities({surface: 'example.account'}).surface, 'example.account');
  for (const surface of ['', 'bad surface', '../bad', 'x'.repeat(129), null]) assert.throws(() => createRendererCapabilities({surface}), TypeError);
});

test('every advertised component has a native renderer without an unsupported fallback', async () => {
  const server = await createServer({root: fileURLToPath(new URL('../../../', import.meta.url)), configFile: false, envDir: false,
    server: {middlewareMode: true, hmr: false}, appType: 'custom'});
  try {
    const {Tree} = await server.ssrLoadModule('/packages/react/src/components.jsx');
    const svgChildren=new Set('g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop marker desc'.split(' '));
    for (const type of createRendererCapabilities().components) {
      const node={type,props:['audio','video'].includes(type)?{src:'/sample.webm'}:{},children:[]};
      const html = renderToStaticMarkup(React.createElement(Tree, {node:svgChildren.has(type)?{type:'svg',props:{},children:[node]}:node, dispatch() {}}));
      assert(!html.includes('data-unsupported'), type);
      if(svgChildren.has(type))assert(html.includes(`<${type}`),type);
      else if(type==='timer')assert.equal(html,'');
      else assert(html.includes(`data-d-component="${type}"`), type);
    }
  } finally {await server.close();}
});
