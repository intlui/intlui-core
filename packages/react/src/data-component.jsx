import React, { useEffect, useRef, useState } from 'react';
export function DataSource({props:p,common,call}) {
  const [status,setStatus]=useState(''),[error,setError]=useState(false),[revision,setRevision]=useState(0);
  const latest=useRef(call);latest.current=call;
  useEffect(()=>{
    if(!p.src)return;
    let disposed=false;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    setStatus('Loading data…');setError(false);latest.current('onLoading');
    (async()=>{try{
      const url=new URL(p.src,location.href);if(url.origin!==location.origin)throw Error('Use a same-origin source or a host adapter.');
      const response=await fetch(url,{signal:controller.signal});
      const reader=response.body.getReader(),chunks=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw Error('Response is too large.');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      const data=JSON.parse(new TextDecoder().decode(bytes));if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
      if(controller.signal.aborted)return;
      latest.current('onData',data);setStatus('Data loaded.');
    }catch(e){if(!controller.signal.aborted){setError(true);setStatus(`Data unavailable: ${e instanceof SyntaxError?'invalid JSON response':e.message}`);latest.current('onError',e.message);}else if(!disposed){setError(true);setStatus('Loading timed out.');latest.current('onError','Loading timed out.');}}
    finally{clearTimeout(timeout);}})();
    return ()=>{disposed=true;clearTimeout(timeout);controller.abort();};
  },[p.src,revision]);
  return <section {...common}><p role={error?'alert':'status'}>{status}</p><button className="intl-button" onClick={()=>setRevision(v=>v+1)}>Reload data</button></section>;
}
