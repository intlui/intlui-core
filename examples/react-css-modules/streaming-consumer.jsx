import React, {useState} from 'react';
import {createTurnState,reduceEvent} from '@intlui/protocol';
import {IntluiAnswer,IntluiProvider} from '@intlui/react';

export const streamingMetrics={checkboxRenders:0,completedRenders:0,revision:1};
function Checkbox({checked,onChange,children,...props}) {
  streamingMetrics.checkboxRenders++;
  return <label><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)} disabled={props.disabled}/>{children}</label>;
}
const components={checkbox:Checkbox};
const report=()=>{streamingMetrics.completedRenders++;};
function apply(state,payload){return reduceEvent(state,{version:'0.1',projectId:state.projectId,conversationId:state.conversationId,turnId:state.turnId,sequence:state.sequence+1,turnRevision:0,...payload});}
function initial(){
  const state=createTurnState({projectId:'stream-demo',conversationId:'local',turnId:'first'},{surface:'react',formats:['dil'],components:['checkbox','text']});
  return apply(state,{type:'ui.create',block:{id:'control',format:'dil',revision:1,requiredComponents:['checkbox','text'],
    source:'{@body const data=DIL.useAppData()}\n{@body const [done,setDone]=DIL.useState(false)}\n<checkbox checked={done} onChange={setDone}>Local selection</checkbox><text>{data.note}</text>',appData:{note:'Revision 1'}}});
}
export function StreamingConsumer(){
  const [state,setState]=useState(initial),[theme,setTheme]=useState('light');
  return <IntluiProvider theme={theme} components={components}>
    <button onClick={()=>setState(current=>apply(current,{type:'text.delta',text:'More text. '}))}>Add text only</button>
    <button onClick={()=>setState(current=>{
      const revision=current.blocks[0].revision+1;streamingMetrics.revision=revision;
      return apply(current,{type:'ui.data',id:'control',revision,appData:{note:`Revision ${revision}`}});
    })}>Update UI data</button>
    <button onClick={()=>setTheme(current=>current==='light'?'dark':'light')}>Change theme</button>
    <IntluiAnswer state={state} onRendered={report}/>
  </IntluiProvider>;
}
