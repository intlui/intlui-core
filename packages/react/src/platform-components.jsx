import React, { useEffect, useRef, useState } from 'react';
import { safeLink } from './visual-model.js';
import { downloadBytes, downloadName, fileLimit, timerInterval } from './platform-model.js';

export function Timer({ props: p, call }) {
  const latest = useRef(call); latest.current = call;
  useEffect(() => {
    if (!p.running) return;
    let previous = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), delta = now - previous; previous = now;
      latest.current('onTick', { delta, now: Date.now() });
    }, timerInterval(p.interval));
    return () => clearInterval(id);
  }, [p.running, p.interval, p.resetKey]);
  return null;
}

export function FileInput({ props: p, common, call }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const version = useRef(0), latest = useRef(call); latest.current = call;
  useEffect(() => () => { version.current++; }, []);
  const read = async event => {
    const file = event.target.files?.[0], ticket = ++version.current;
    event.target.value = '';
    if (!file) return;
    setError(''); setBusy(true);
    try {
      if (file.size > fileLimit(p.maxBytes)) throw new Error('File exceeds the size limit for this control.');
      let content;
      if (p.encoding === 'base64') {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let raw = ''; for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
        content = btoa(raw);
      } else content = await file.text();
      if (version.current !== ticket) return;
      latest.current('onChange', { name: file.name, type: file.type, size: file.size, content, encoding: p.encoding === 'base64' ? 'base64' : 'utf8' });
    } catch (e) { if (version.current === ticket) { setError(e.message); latest.current('onError', e.message); } }
    finally { if (version.current === ticket) setBusy(false); }
  };
  return <div {...common}><label>{p.label || 'Select file'}<input type="file" accept={p.accept} disabled={p.disabled || busy} onChange={read} aria-label={p['aria-label'] || p.label || 'Select file'} /></label>{busy && <p role="status">Reading file…</p>}{error && <p role="alert">{error}</p>}</div>;
}

export function Download({ props: p, common, children, call }) {
  const [error, setError] = useState('');
  const urls = useRef(new Map());
  useEffect(() => () => { for (const [url,timer] of urls.current) { clearTimeout(timer); URL.revokeObjectURL(url); } urls.current.clear(); }, []);
  const download = () => {
    try {
      const bytes = downloadBytes(p.content, p.encoding);
      const url = URL.createObjectURL(new Blob([bytes], { type: p.mime || 'application/octet-stream' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = downloadName(p.filename); document.body.append(anchor); anchor.click(); anchor.remove();
      urls.current.set(url,setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 1000));
      setError(''); call('onDownload', { name: anchor.download, size: bytes.length });
    } catch (e) { setError(e.message); call('onError', e.message); }
  };
  return <div {...common}><button type="button" disabled={p.disabled} onClick={download}>{children}</button>{error && <p role="alert">{error}</p>}</div>;
}

export function Media({ type, props: p, common, call }) {
  const ref = useRef(null), latest = useRef(call); latest.current = call;
  const [volume,setVolume] = useState(1);
  const [status, setStatus] = useState('Loading media…');
  const src = safeLink(p.src), Tag = type;
  useEffect(() => {
    const el = ref.current; setStatus('Loading media…');
    if (!el) return;
    el.src = src; el.load();
    return () => { el.pause(); el.removeAttribute('src'); el.load(); };
  }, [src]);
  if (!src) return <p role="alert">Invalid media source.</p>;
  const state = () => { const el = ref.current; return { currentTime: el.currentTime, duration: Number.isFinite(el.duration) ? el.duration : null, paused: el.paused, volume: el.volume, muted: el.muted }; };
  return <figure {...common}><Tag ref={ref} src={src} controls preload="metadata" playsInline={type === 'video' ? true : undefined} muted={p.muted} loop={p.loop} poster={type === 'video' ? safeLink(p.poster) : undefined} aria-label={p['aria-label'] || p.title || type} onLoadedMetadata={() => { setStatus(''); call('onReady', state()); }} onPlay={() => call('onPlay', state())} onPause={() => call('onPause', state())} onEnded={() => call('onEnded', state())} onSeeked={() => call('onSeek', state())} onVolumeChange={() => { setVolume(ref.current.volume); call('onVolumeChange', state()); }} onError={() => { setStatus('Media unavailable or unsupported format.'); latest.current('onError', 'Media unavailable or unsupported format.'); }} />{p.title && <figcaption>{p.title}</figcaption>}<label>Volume <input type="range" aria-label={`Volume ${type}`} min="0" max="1" step="0.05" value={volume} onChange={e=>{const value=Number(e.target.value);setVolume(value);ref.current.volume=value;if(value>0)ref.current.muted=false;}}/></label>{status && <p role="status">{status}</p>}</figure>;
}
