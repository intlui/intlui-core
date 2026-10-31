import React, { useEffect, useRef, useState } from 'react';
import { safeLink } from './visual-model.js';

export function ImageViewer({ asset, onClose }) {
  const dialog = useRef(null), [zoom, setZoom] = useState(1), [error, setError] = useState(false);
  useEffect(() => {
    if (!asset) return;
    const el = dialog.current, previous = document.activeElement;
    setZoom(1); setError(false); el.showModal();
    return () => { el.close(); if(previous?.isConnected)previous.focus(); };
  }, [asset]);
  if (!asset) return null;
  const src = safeLink(asset.src);
  return <dialog ref={dialog} className="intl-image-viewer" aria-label="Image preview" onClose={onClose}>
    <div className="intl-viewer-controls"><strong>{asset.alt || 'Image'}</strong><label>Zoom <input aria-label="Image zoom" type="range" min="1" max="3" step="0.1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><button type="button" onClick={()=>dialog.current.close()}>Close image</button></div>
    <div className="intl-viewer-image">{src&&!error?<img src={src} alt={asset.alt||''} style={{width:`${zoom*100}%`,maxWidth:'none'}} onError={()=>setError(true)}/>:<p role="alert">Image unavailable.</p>}</div>
  </dialog>;
}
