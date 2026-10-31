import React, { useEffect, useRef, useState } from 'react';

const prefix = 'intl-ui:document:v1:';
export function LocalStore({ props: p, common, call }) {
  const [status,setStatus]=useState(''),[error,setError]=useState(false);
  const latest=useRef(call);latest.current=call;
  const key=typeof p.storageKey==='string'&&/^[a-zA-Z0-9._-]{1,100}$/.test(p.storageKey)?prefix+p.storageKey:null;
  const fail=e=>{setError(true);setStatus(`Local storage unavailable: ${e.message}`);latest.current('onError',e.message);};
  useEffect(()=>{
    try {
      if(!key)throw Error('Invalid key.');
      const raw=localStorage.getItem(key);
      if(raw!==null){
        if(raw.length>1000000)throw Error('Document is too large.');
        const stored=JSON.parse(raw);
        if(stored?.version!==1||!Object.hasOwn(stored,'value'))throw Error('Unrecognized document format.');
        latest.current('onLoad',stored.value);setStatus('Local document loaded.');
      }else setStatus('No local document saved.');
      setError(false);
    } catch(e){fail(e);}
  },[key]);
  const save=()=>{
    try {
      if(!key)throw Error('Invalid key.');
      const raw=JSON.stringify({version:1,value:p.value});
      if(raw.length>1000000)throw Error('Document is too large.');
      localStorage.setItem(key,raw);setStatus('Saved in this browser.');setError(false);call('onSave');
    }catch(e){fail(e);}
  };
  const reset=()=>{
    try {
      if(!key)throw Error('Invalid key.');
      localStorage.removeItem(key);setError(false);setStatus('Saved document deleted.');call('onReset');
    }catch(e){fail(e);}
  };
  return <section {...common}><div className="intl-row"><button className="intl-button" onClick={save}>Save in this browser</button><button className="intl-button" onClick={reset}>Delete saved document</button></div><p role={error?'alert':'status'}>{status}</p><small>Manual storage in this browser and origin. No synchronization across devices.</small></section>;
}
