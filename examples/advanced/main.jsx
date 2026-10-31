import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DilSource, IntluiProvider, ImageViewer} from '@intlui/react';
import '@intlui/react/styles.css';
import '../vite-node/style.css';
import {samples} from './samples.js';

const host={resolveImage:()=>({src:'/sample.svg',alt:'Synthetic illustration'}),references:{guide:{url:'#guide',title:'Demo guide'}}};
function App(){
  const [selected,setSelected]=useState(samples[0].id),[revision,setRevision]=useState(0),[asset,setAsset]=useState(null);
  const sample=samples.find(item=>item.id===selected);
  return <main><h1>IntlUI advanced components</h1><p id="guide">Local synthetic examples without AI. Switching examples starts a new interface.</p>
    <nav aria-label="Examples">{samples.map(item=><button key={item.id} aria-pressed={item.id===selected} onClick={()=>setSelected(item.id)}>{item.title}</button>)}</nav>
    <button onClick={()=>setRevision(value=>value+1)}>Update data without resetting controls</button>
    <IntluiProvider host={{...host,onOpenImage:setAsset}}><DilSource key={sample.id} source={sample.source} appData={{title:`Update ${revision}`,rows:[{x:1,y:2+revision},{x:3,y:5+revision}]}}/></IntluiProvider>
    <ImageViewer asset={asset} onClose={()=>setAsset(null)}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
