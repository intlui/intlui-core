import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { safeLink, svgProps, svgTags } from './visual-model.js';

export const HostContext = createContext({});
export const RadioContext = createContext(null);

// Native editing stays synchronous while the worker acknowledges changes.
// Incoming values are applied once focus leaves the field (including resets).
export function TextField({ multiline, props: p, common, change, blur }) {
  const [draft, setDraft] = useState(p.value ?? '');
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(p.value ?? ''); }, [p.value, focused]);
  const Tag = multiline ? 'textarea' : 'input';
  return <Tag {...common} type={multiline ? undefined : ['number','email','text'].includes(p.inputType) ? p.inputType : 'text'} aria-label={p['aria-label'] || p.placeholder || (multiline ? 'Multiline text' : 'Text')} value={draft} placeholder={p.placeholder} rows={multiline ? p.rows : undefined} disabled={p.disabled} readOnly={p.readOnly} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); blur(); }} onChange={e => { setDraft(e.target.value); change(e.target.value); }} />;
}

export function Vector({ node, common }) {
  const prefix = useId().replace(/[^\w-]/g, '');
  function draw(n, key) {
    if (n == null || typeof n === 'boolean') return null;
    if (typeof n !== 'object') return n;
    if (Array.isArray(n)) return n.map((v, i) => draw(v, v?.key ?? i));
    if (!svgTags.has(n.type)) return null;
    return React.createElement(n.type, { ...svgProps(n.props || {}, prefix), key }, draw(n.children));
  }
  return <svg {...common} {...svgProps(node.props || {}, prefix)} role="img" aria-label={node.props?.['aria-label'] || 'Vector graphic'}>{draw(node.children)}</svg>;
}

export function Carousel({ children, props: p, common, onChange }) {
  const track = useRef(null);
  const count = [children.props.node].flat(Infinity).filter(n => n && typeof n === 'object').length;
  const [local, setLocal] = useState(0);
  const index = Math.max(0, Math.min(count - 1, Number(p.activeIndex ?? local) || 0));
  useEffect(() => {
    const el = track.current;
    const align = () => { const item = el?.children[index]; if (item) el.scrollTo({ left: item.offsetLeft }); };
    align();
    const observer = new ResizeObserver(align); observer.observe(el);
    return () => observer.disconnect();
  }, [index, count]);
  const move = next => { setLocal(next); onChange(next); };
  return <div {...common}>
    {p.showArrows && <div className="intl-carousel-controls"><button type="button" aria-label="Previous" disabled={index <= 0} onClick={() => move(index - 1)}>‹</button><button type="button" aria-label="Next" disabled={index >= count - 1} onClick={() => move(index + 1)}>›</button></div>}
    <div className="intl-carousel-track" ref={track} style={{ gap: common.style.gap, '--visible-items': Math.max(1, Math.min(12, Number(p.visibleItems) || 1)) }} tabIndex={0} aria-label="Carousel">{children}</div>
  </div>;
}

export function ResolvedImage({ props: p, common }) {
  const host = useContext(HostContext);
  const [state, setState] = useState({});
  const key = JSON.stringify([p.ref, p.query, p.group]);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setState({});
    if (host.resolveImage) Promise.resolve().then(() => host.resolveImage({ ref: p.ref, query: p.query, group: p.group }, { signal: controller.signal })).then(asset => { if (current) setState({ key, asset }); }, () => { if (current) setState({ key, error: true }); });
    return () => { current = false; controller.abort(); };
  }, [key, host.resolveImage]);
  const asset = state.key === key ? state.asset : null;
  const src = safeLink(asset?.src);
  const ratio = typeof p.aspectRatio === 'string' && /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(p.aspectRatio) ? p.aspectRatio.replace(':', '/') : undefined;
  if (!src) return <div {...common} role="status">{!host.resolveImage ? 'Image: host resolver not configured.' : state.key === key ? 'Image unavailable.' : 'Loading image…'}</div>;
  return <figure {...common}><img src={src} alt={p.alt || asset.alt || ''} style={{ width: '100%', aspectRatio: ratio, objectFit: p.fit === 'contain' ? 'contain' : 'cover', maxHeight: typeof p.maxHeight === 'number' ? p.maxHeight : undefined, borderRadius: common.style.borderRadius }} onError={() => setState({ key, error: true })} />{host.onOpenImage && <button type="button" onClick={() => host.onOpenImage(asset)}>Open image</button>}</figure>;
}

export function Reference({ type, props: p, children, common }) {
  const host = useContext(HostContext);
  const refs = (Array.isArray(p.refs) ? p.refs : p.ref ? [p.ref] : []).filter(ref => typeof ref === 'string').slice(0,100);
  if (type === 'Entity') return <span {...common}>{p.value || children}</span>;
  return <span {...common}>{refs.map(ref => {
    const entry = host.references?.[ref], href = safeLink(entry?.url);
    return href ? <a key={ref} href={href} target="_blank" rel="noopener noreferrer">{entry.title || ref}</a> : <span key={ref} role="status">[Unresolved reference: {String(ref)}]</span>;
  })}</span>;
}

export function Radio({ props: p, children, common }) {
  const group = useContext(RadioContext);
  return <label {...common}><input type="radio" name={group?.name} value={p.value} checked={group?.value === p.value} disabled={p.disabled || group?.disabled} onChange={() => group?.change(p.value)} />{children}</label>;
}
export function RadioGroup({ props: p, children, common, change }) {
  const name = useId();
  return <RadioContext.Provider value={{ name, value: p.value, disabled: p.disabled, change }}><div {...common} role="radiogroup" aria-label={p['aria-label'] || 'Choice'}>{children}</div></RadioContext.Provider>;
}
