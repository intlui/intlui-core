import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCapabilities,validateBlock} from '../src/index.js';
const caps={surface:'react',formats:['dil'],components:['text']};
const block={id:'a',format:'dil',source:'<text/>',appData:{},revision:1,requiredComponents:['text']};

test('capability boundaries reject sparse arrays and accept exactly 128 unique components',()=>{
  for(const components of [new Array(1),['text',,'button'],['text','text'],[''],[null]])assert.throws(()=>validateCapabilities({...caps,components}));
  const components=Array.from({length:128},(_,i)=>`c${i}`);
  validateCapabilities({...caps,components});
  assert.throws(()=>validateCapabilities({...caps,components:[...components,'extra']}));
  assert.throws(()=>validateBlock({...block,requiredComponents:new Array(1)}));
});

test('source boundaries, cyclic data and reserved nested keys are rejected without mutation',()=>{
  validateBlock({...block,source:'x'.repeat(50000)});
  assert.throws(()=>validateBlock({...block,source:'x'.repeat(50001)}));
  const cyclic={};cyclic.child=cyclic;
  for(const appData of [cyclic,{nested:JSON.parse('{"constructor":1}')},{nested:{value:NaN}}])assert.throws(()=>validateBlock({...block,appData}));
  assert.equal(cyclic.child,cyclic);
  const appData=Object.freeze({count:1});validateBlock({...block,appData});assert.equal(appData.count,1);
});
