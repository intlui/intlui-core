import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {compileDil} from '@intlui/react/compiler';
import {Tree, HostContext, chartModel, svgProps, safeLink} from '@intlui/react/primitives';
import {createRendererCapabilities} from '@intlui/react/capabilities';
import {validateCapabilities} from '@intlui/protocol';
import {createRuntime} from '../src/runtime.js';
import {validateSandboxMessage} from '../src/sandbox-message.js';
import {samples} from '../../../examples/advanced/samples.js';

const flatten=tree=>Array.isArray(tree)?tree.flatMap(flatten):tree&&typeof tree==='object'?[tree,...flatten(tree.children)]:[];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const source=`{@body const data=DIL.useAppData()}
{@body const [note,setNote]=DIL.useState('')}
{@body const [count,setCount]=DIL.useState(0)}
<form onSubmit={()=>setCount(count+1)}><textarea value={note} onChange={setNote}/><button>Save</button></form>
<text>{data.title}: {count}</text>
<timer running={data.running} interval=100 onTick={()=>setCount(n=>n+1)}/>
<Chart content={{chartType:'scatter',xKey:'x',data:data.rows,series:[{dataKey:'y'}]}}/>
<svg viewBox="0 0 100 100"><defs><linearGradient id="shade"><stop offset="0%" stopColor="#fff"/></linearGradient></defs><rect width=30 height=30 fill="url(#shade)"/></svg>
<carousel><carousel-item>First</carousel-item><carousel-item>Second</carousel-item></carousel>
<webgl-scene vertices={[0,0,0,1,0,0,0,1,0]}/>
<geo-map src="/map.json"/><data-source src="/data.json"/><file-input/><download filename="sample.txt" content={note}>Download</download>
<audio src="/sample.wav"/><video src="/sample.webm"/><local-store storageKey="advanced-test" value={note}/><drag-board columns={[]} items={[]}/>
<Cite ref="source"/>`;

test('advanced public components compile, cross the worker boundary and render without browser side effects',async()=>{
  validateCapabilities(createRendererCapabilities());
  const compiled=compileDil(source),messages=[];
  assert(compiled.diagnostics.some(d=>d.code==='library-extension'));
  assert(compiled.diagnostics.every(d=>d.severity==='info'));
  assert(compiled.requiredComponents.every(name=>createRendererCapabilities().components.includes(name)));
  const runtime=createRuntime(message=>messages.push(message));
  runtime.load({...compiled.payload,appData:{title:'Original',rows:[{x:2,y:5}],running:true}});
  const snapshot=()=>messages.findLast(m=>m.type==='snapshot');
  validateSandboxMessage({...snapshot(),sequence:1},1);
  const textarea=()=>flatten(snapshot().tree).find(node=>node.type==='textarea');
  const id=textarea().props.onChange.$callback;
  runtime.trigger(id,['Typed locally']);await tick();
  runtime.updateData({title:'Updated',rows:[{x:3,y:7}],running:true});
  assert.equal(textarea().props.value,'Typed locally');assert.equal(textarea().props.onChange.$callback,id);
  runtime.trigger(flatten(snapshot().tree).find(node=>node.type==='timer').props.onTick.$callback,[{now:1,delta:100}]);await tick();
  const html=renderToStaticMarkup(React.createElement(HostContext.Provider,{value:{references:{source:{url:'https://example.com',title:'Source'}}}},React.createElement(Tree,{node:snapshot().tree,dispatch(){}})));
  for(const pattern of [/<textarea/,/Typed locally/,/Updated: 1/,/data-chart-type="scatter"/,/<linearGradient/,/<canvas/,/type="file"/,/<audio/,/<video/,/href="https:\/\/example.com\//])assert.match(html,pattern);
  assert.doesNotMatch(html,/data-unsupported/);
  runtime.dispose();
});

test('numeric attributes retain translation spans and visual helpers reject unsafe resources',()=>{
  const source='<box padding=4><text>Safe</text></box>',parsed=compileDil(source).ast.children[0];
  assert.equal(source.slice(parsed.attributes[0].start,parsed.attributes[0].end),'padding=4');
  assert.equal(safeLink('javascript:alert(1)'),undefined);
  assert.deepEqual(svgProps({id:'a',fill:'url(#a)',onLoad:'bad',href:'https://example.com'},'scope'),{id:'scope-a',fill:'url(#scope-a)'});
  const model=chartModel([{x:1,y:2},{x:9,y:null}],[{type:'scatter',dataKey:'y'}],{dataKey:'x'});
  assert.equal(model.series[0].points.filter(point=>point.valid).length,1);
});

test('all public advanced examples render through the isolated runtime contract',()=>{
  for(const sample of samples){
    const messages=[],runtime=createRuntime(message=>messages.push(message));
    runtime.load({...compileDil(sample.source).payload,appData:{title:'Example',rows:[{x:1,y:2}]}});
    assert(!messages.some(message=>message.type==='error'),sample.id);
    const snapshot=messages.findLast(message=>message.type==='snapshot');
    validateSandboxMessage({...snapshot,sequence:1},1);
    const html=renderToStaticMarkup(React.createElement(Tree,{node:snapshot.tree,dispatch(){}}));
    assert.doesNotMatch(html,/data-unsupported/,sample.id);runtime.dispose();
  }
});
