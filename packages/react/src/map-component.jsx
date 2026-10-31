import React, { useEffect, useRef, useState } from 'react';
import { safeLink } from './visual-model.js';
import { geoPaths, geoPoint, mapView } from './geo-model.js';
export function GeoMap({props:p,common,call}) {
  const [features,setFeatures]=useState([]),[status,setStatus]=useState('Loading map'),[view,setView]=useState(()=>mapView(360,180,1));
  const pointer=useRef(null), url=safeLink(p.src);
  useEffect(()=>{
    const controller=new AbortController();setFeatures([]);setStatus('Loading map');
    (async()=>{try{
      if(!url)throw Error('Invalid map URL.');
      const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`Map unavailable (${response.status}).`);
      const reader=response.body.getReader(),chunks=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw Error('Geographic file is too large.');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      const paths=geoPaths(JSON.parse(new TextDecoder().decode(bytes)));
      if(!controller.signal.aborted){setFeatures(paths);setStatus(paths.length?`${paths.length} geographic areas`:'Map contains no areas');}
    }catch(error){if(!controller.signal.aborted)setStatus(error instanceof SyntaxError?'Source does not contain valid GeoJSON.':error.message);}})();
    return ()=>controller.abort();
  },[url]);
  const markers=(Array.isArray(p.markers)?p.markers:[]).slice(0,500).filter(m=>Number.isFinite(m.longitude)&&Number.isFinite(m.latitude)&&Math.abs(m.longitude)<=180&&Math.abs(m.latitude)<=90);
  const zoom=delta=>setView(v=>mapView(v.x,v.y,v.zoom*delta));
  return <section {...common}>
    <svg aria-label={p['aria-label']||'Geographic map'} tabIndex={0} viewBox={`${view.x-view.width/2} ${view.y-view.height/2} ${view.width} ${view.height}`} style={{width:'100%',aspectRatio:'2',background:'#d8e9ef',touchAction:'none',borderRadius:12}}
      onPointerDown={e=>{if(e.target.closest('[data-marker]'))return;pointer.current=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!pointer.current)return;const [x,y]=pointer.current;pointer.current=[e.clientX,e.clientY];const rect=e.currentTarget.getBoundingClientRect();setView(v=>mapView(v.x-(e.clientX-x)*v.width/rect.width,v.y-(e.clientY-y)*v.height/rect.height,v.zoom));}}
      onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}
      onWheel={e=>zoom(e.deltaY<0?1.2:1/1.2)}
      onKeyDown={e=>{const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(offsets[e.key]){e.preventDefault();const [x,y]=offsets[e.key];setView(v=>mapView(v.x+x*v.width/10,v.y+y*v.height/10,v.zoom));}}}>
      {features.map(f=><path key={f.id} d={f.path} fill="#e8e5d2" fillRule="evenodd" stroke="#758979" strokeWidth={.5/view.zoom}><title>{f.name}</title></path>)}
      {markers.map((m,i)=>{const [x,y]=geoPoint([m.longitude,m.latitude]);return <circle key={i} data-marker={String(m.id)} cx={x} cy={y} r={5/view.zoom} fill={p.selected===m.id?'#c33d52':'#296fa3'} stroke="white" strokeWidth={1/view.zoom} onClick={()=>call('onSelect',m.id)}><title>{m.label}</title></circle>;})}
    </svg>
    <div className="intl-row"><button onClick={()=>zoom(1.5)}>Zoom in</button><button onClick={()=>zoom(1/1.5)}>Zoom out</button><button onClick={()=>setView(mapView(360,180,1))}>Reset map</button></div>
    <p role="status">{status} · Zoom {view.zoom.toFixed(1)}×</p>
    <div className="intl-row" style={{flexWrap:'wrap'}}>{markers.map((m,i)=><button key={i} aria-pressed={p.selected===m.id} onClick={()=>{const [x,y]=geoPoint([m.longitude,m.latitude]);setView(mapView(x,y,Math.max(3,view.zoom)));call('onSelect',m.id);}}>{m.label}</button>)}</div>
    <small>{p.attribution} · Equirectangular projection. Drag or use arrow keys to pan.</small>
  </section>;
}
