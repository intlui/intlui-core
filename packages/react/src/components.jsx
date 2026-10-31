import React, { createContext, useContext, useState, useId } from 'react';

import { chartModel, safeLink } from './visual-model.js';
import { Carousel, Vector, ResolvedImage, Reference, Radio, RadioGroup, TextField } from './visual-components.jsx';
import { Timer, FileInput, Download, Media } from './platform-components.jsx';
import { DragBoard } from './drag-components.jsx';
import { WebGLScene } from './webgl-component.jsx';
import { GeoMap } from './map-component.jsx';
import { LocalStore } from './storage-component.jsx';
import { DataSource } from './data-component.jsx';

import { rendererMessages } from './messages.js';

export const AdapterContext = createContext({ components: {}, classNames: {} });
const localized = (locale, messages = {}) => ({...rendererMessages(locale), ...messages,
  ...(messages.input ? {text:messages.input} : {}), ...(messages.select ? {selection:messages.select} : {}),
  ...(messages.unsupportedComponent ? {unsupported:messages.unsupportedComponent} : {})});

const spacing = value => typeof value === 'number' ? `calc(var(--intl-space, 4px) * ${value})` : typeof value === 'string' && /^\d+(?:\.\d+)?px$/.test(value) ? value : undefined;
const dimension = value => typeof value === 'number' ? value : typeof value === 'string' && /^(?:\d+(?:\.\d+)?(?:px|%|rem|em|vh|vw)?|auto)$/.test(value) ? value : undefined;
const color = value => ({ primary: 'var(--accent)', emphasis: 'var(--accent)', secondary: 'var(--muted)', tertiary: 'var(--muted)', subtle: 'var(--line)', strong: 'var(--ink)', default: 'var(--ink)', success: '#27804b', danger: '#bc3434', warning: '#956522', surface: 'var(--paper)', 'surface-secondary': 'var(--surface)', 'surface-tertiary': 'var(--surface)' })[value] || (/^(#(?:[\da-f]{3,8})|rgba?\([\d.,%\s]+\))$/i.test(value || '') ? value : undefined);
const border = value => value ? `${typeof value.size === 'number' ? Math.max(0, value.size) : 1}px solid ${color(value.color) || 'var(--line)'}` : undefined;
function style(props, type) {
  const radii = { none: 0, sm: 4, md: 8, lg: 12, xl: 16, '2xl': 20, full: 999 };
  const sizes = { '2xs': 10, xs: 12, sm: 14, md: 16, lg: 20, xl: 26, '2xl': 34 };
  return {
    gap: spacing(props.gap), padding: spacing(props.padding),
    ...(props.padding && typeof props.padding === 'object' ? Object.fromEntries(['Top', 'Right', 'Bottom', 'Left'].map(side => [`padding${side}`, spacing(props.padding[side.toLowerCase()] ?? props.padding[['Top', 'Bottom'].includes(side) ? 'y' : 'x'])])) : {}),
    border: props.border && !['top','right','bottom','left'].some(side=>props.border[side]) ? border(props.border) : undefined,
    ...(props.border && typeof props.border === 'object' ? Object.fromEntries(['Top','Right','Bottom','Left'].filter(side=>props.border[side.toLowerCase()]).map(side=>[`border${side}`,border(props.border[side.toLowerCase()])])) : {}),
    borderRadius: props.radius === 'full' ? 9999 : radii[props.radius] === 0 ? 0 : radii[props.radius] ? `calc(var(--intl-radius, 12px) * ${radii[props.radius] / 12})` : undefined, background: color(props.background), color: color(props.color),
    width: dimension(props.width ?? (type === 'box' ? props.size : undefined)),
    height: dimension(props.height ?? (type === 'box' ? props.size : undefined)),
    minWidth: dimension(props.minWidth), maxWidth: dimension(props.maxWidth), minHeight: dimension(props.minHeight), maxHeight: dimension(props.maxHeight),
    flex: props.flex, flexDirection: props.direction === 'col' ? 'column' : props.direction,
    alignItems: ({ start: 'flex-start', end: 'flex-end' })[props.align] || props.align,
    justifyContent: ({ between: 'space-between', start: 'flex-start', end: 'flex-end' })[props.justify] || props.justify,
    flexWrap: props.wrap ? 'wrap' : undefined, overflow: props.clip ? 'hidden' : undefined,
    fontSize: type !== 'box' ? sizes[props.size] : undefined,
    fontStyle: props.italic ? 'italic' : undefined, textDecoration: props.lineThrough ? 'line-through' : undefined,
    whiteSpace: props.preserveWhitespace ? 'pre-wrap' : undefined,
    fontWeight: ({ medium: 500, semibold: 600, bold: 700 })[props.weight],
    fontVariantNumeric: props.tabularNums ? 'tabular-nums' : undefined,
    textAlign: props.textAlign,
    gridTemplateColumns: type === 'grid' ? (props.minChildWidth ? `repeat(auto-fit, minmax(min(100%, ${typeof props.minChildWidth === 'number' ? `${Math.max(1,props.minChildWidth)}px` : dimension(props.minChildWidth) || '240px'}), 1fr))` : `repeat(${Math.min(12, Math.max(1, Number(props.columns) || 1))}, minmax(0, 1fr))`) : undefined,
  };
}

const chartValue = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

export function Chart({ data = [], series = [], xAxis = {}, yAxis = {}, meta = {}, height = 280, className = 'intl-chart', style: hostStyle, 'aria-label': accessibleName }) {
  const clipId = useId();
  const {locale, messages} = useContext(AdapterContext);
  const t = localized(locale, messages);
  const name = typeof accessibleName === 'string' && accessibleName.trim() ? accessibleName : `${t.chart}: ${Array.isArray(series) ? series.map(s => s?.label || s?.dataKey).join(', ') : ''}`;
  const model = chartModel(data, series, xAxis, yAxis);
  if (!model) return <p role="status" className={className} style={hostStyle} data-d-component="chart">{t.unsupportedChart}</p>;
  const width = 640, plotHeight = 210, left = 42, top = 18, plotWidth = width - left - 16;
  const { min, max, y, step } = model;
  const colors = ['#397569', '#c48345', '#6c68b4', '#b34f73'];
  return <figure className={className} style={hostStyle} data-d-component="chart">
    <svg viewBox={`0 0 ${width} 265`} style={{ height: dimension(height), maxHeight: 500 }} role="img" aria-label={name}>
      <defs><clipPath id={clipId}><rect x={left-4} y={top-4} width={plotWidth+8} height={plotHeight+8} /></clipPath></defs>
      {[0, 0.5, 1].map(t => { const value = min + (max - min) * t; return <g key={t}><line x1={left} x2={width - 16} y1={y(value)} y2={y(value)} stroke="var(--line)" /><text x={left - 8} y={y(value) + 4} textAnchor="end">{Math.round(value * 10) / 10}</text></g>; })}
      {series.map((s, index) => {
        const fill = colors[index % colors.length];
        const points = model.series[index].points;
        const baseline = y(Math.max(min,Math.min(max,0)));
        return <g key={s.dataKey} data-series={s.dataKey} data-chart-type={s.type} clipPath={`url(#${clipId})`}>
          {s.type === 'line' && <path d={points.map((p, i) => p.valid ? `${i && points[i - 1].valid ? 'L' : 'M'}${p.x},${p.y}` : '').join(' ')} fill="none" stroke={fill} strokeWidth="3" />}
          {points.filter(p => p.valid).map((p, i) => s.type !== 'bar' ? <circle key={i} cx={p.x} cy={p.y} r="4" fill={fill}><title>{`${p.row[xAxis.dataKey] ?? ""} · ${s.label || s.dataKey}: ${p.value}${s.valueSuffix || ""}`}</title></circle> : <rect key={i} x={p.x - step * 0.36 + index * step * 0.72 / series.length} y={Math.min(p.y, baseline)} width={Math.max(1, step * 0.72 / series.length - 3)} height={Math.abs(baseline - p.y)} rx="3" fill={fill}><title>{`${p.row[xAxis.dataKey] ?? ""} · ${s.label || s.dataKey}: ${p.value}${s.valueSuffix || ""}`}</title></rect>)}
        </g>;
      })}
      {model.numericX ? [0, .5, 1].map(t => <text key={t} x={left + plotWidth * t} y="252" textAnchor="middle">{Math.round((model.xmin + (model.xmax - model.xmin) * t) * 100) / 100}</text>) : data.map((row, i) => <text key={i} x={left + step * (i + 0.5)} y="252" textAnchor="middle">{String(row[xAxis.dataKey] ?? i)}</text>)}
    </svg>
    <figcaption>{series.map((s, i) => <span key={s.dataKey}><i style={{ background: colors[i % colors.length] }} />{s.label || s.dataKey}</span>)}</figcaption>
    {meta?.footer && <small>{meta.footer}</small>}
    <details className="intl-chart-data"><summary>{t.chartData}</summary>
      {!data.length || !series.length ? <p>{t.emptyChart}</p> : <div className="intl-table-scroll"><table className="intl-table">
        <caption>{name}</caption>
        <thead><tr><th scope="col">{String(xAxis.label || xAxis.dataKey || t.category)}</th>{series.map((s,i)=><th key={i} scope="col">{s.label || s.dataKey}</th>)}</tr></thead>
        <tbody>{data.map((row,i)=><tr key={i}><th scope="row">{String(row[xAxis.dataKey] ?? i)}</th>{series.map((s,j)=>{const value=chartValue(row[s.dataKey]);return <td key={j}>{Number.isFinite(value)?String(value):t.missingData}</td>;})}</tr>)}</tbody>
      </table></div>}
    </details>
  </figure>;
}

export function Tree({ node, dispatch }) {
  const { components = {}, classNames = {}, locale, messages, sequence = 0 } = useContext(AdapterContext);
  const t = localized(locale, messages);
  const [pending, setPending] = useState(null);
  if (node == null || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map((child, i) => <Tree key={child?.key ?? i} node={child} dispatch={dispatch} />);
  const type = node.type;
  const controlledProp = type === 'checkbox' ? 'checked' : ['input', 'textarea', 'date-picker', 'slider', 'select', 'segmented-control', 'radio-group'].includes(type) ? 'value' : null;
  // React restores controlled inputs after each event. Keep the newest local
  // value until a worker snapshot acknowledges it; older snapshots must not
  // overwrite typing that is still in flight. Applies to custom adapters too.
  const p = pending && pending.sequence > sequence && controlledProp
    ? { ...node.props, [controlledProp]: pending.value } : node.props || {};
  const children = <Tree node={node.children} dispatch={dispatch} />;
  const call = (name, ...args) => {
    if (!Number.isInteger(p[name]?.$callback)) return;
    const sent = dispatch(p[name].$callback, ...args);
    if (name === 'onChange' && controlledProp && Number.isInteger(sent)) setPending({ sequence: sent, value: args[0] });
  };
  const common = { 'data-d-component': type, className: [`intl-${type}`, classNames[type]].filter(Boolean).join(' '), style: style(p, type) };
  const Adapter = components[type];
  if (Adapter) return <Adapter {...p} {...common} onChange={value => call('onChange', value)} onClick={() => call('onClick')}>{children}</Adapter>;
  if (type === 'timer') return <Timer props={p} call={call} />;
  if (type === 'webgl-scene') return <WebGLScene props={p} common={common} />;
  if (type === 'geo-map') return <GeoMap props={p} common={common} call={call} />;
  if (type === 'local-store') return <LocalStore props={p} common={common} call={call} />;
  if (type === 'data-source') return <DataSource props={p} common={common} call={call} />;
  if (type === 'drag-board') return <DragBoard props={p} common={common} call={call} />;
  if (type === 'file-input') return <FileInput props={p} common={common} call={call} />;
  if (type === 'download') return <Download props={p} common={common} call={call}>{children}</Download>;
  if (type === 'audio' || type === 'video') return <Media type={type} props={p} common={common} call={call} />;
  if (type === 'svg') return <Vector node={node} common={{ ...common, style: { ...common.style, width: dimension(p.width ?? p.size), height: dimension(p.height ?? p.size) } }} />;
  if (type === 'carousel') return <Carousel props={p} common={common} onChange={value => call('onChange', value)}>{children}</Carousel>;
  if (type === 'AsyncImage') return <ResolvedImage props={p} common={common} />;
  if (type === 'Cite' || type === 'Entity') return <Reference type={type} props={p} common={common}>{children}</Reference>;
  if (type === 'Link') { const href = safeLink(p.url); return href ? <a {...common} href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{node.children?.flat(Infinity).length ? children : p.title || p.url}</a> : <span {...common}>{children} [Invalid link]</span>; }
  if (type === 'form') return <form {...common} onSubmit={e => { e.preventDefault(); call('onSubmit'); }}>{children}</form>;
  if (type === 'radio-group') return <RadioGroup props={p} common={common} change={value => call('onChange', value)}>{children}</RadioGroup>;
  if (type === 'radio') return <Radio props={p} common={common}>{children}</Radio>;
  if (type === 'textarea') return <TextField multiline props={p} common={common} change={value=>call('onChange',value)} blur={()=>call('onBlur')} />;
  if (type === 'date-picker') return <input {...common} type="date" aria-label={p['aria-label'] || p.placeholder || 'Date'} value={p.value ?? ''} min={p.min} max={p.max} disabled={p.disabled} onChange={e => call('onChange', e.target.value)} />;
  if (type === 'slider') return <input {...common} type="range" aria-label={p['aria-label'] || t.value} min={p.min} max={p.max} step={p.step} value={p.value ?? 0} disabled={p.disabled} onChange={e => call('onChange', Number(e.target.value))} />;
  if (type === 'input') return <input {...common} disabled={p.disabled} type={['number', 'email', 'text'].includes(p.inputType) ? p.inputType : 'text'} aria-label={p['aria-label'] || p.placeholder || t.text} value={p.value ?? ''} placeholder={p.placeholder} onChange={e => call('onChange', e.target.value)} />;
  if (type === 'checkbox') return <label {...common}><input type="checkbox" aria-label={p['aria-label'] || undefined} disabled={p.disabled} checked={!!p.checked} onChange={e => call('onChange', e.target.checked)} /> <span>{children}</span></label>;
  if (type === 'select') return <select {...common} disabled={p.disabled} aria-label={p['aria-label'] || t.selection} value={p.value} onChange={e => call('onChange', e.target.value)}>{(p.options || []).map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>;
  if (type === 'segmented-control') return <div {...common} role="group" aria-label={p['aria-label'] || t.options}>{(p.options || []).map(option => <button type="button" disabled={p.disabled || option.disabled} key={option.value} aria-pressed={p.value === option.value} onClick={() => call('onChange', option.value)}>{option.label}</button>)}</div>;
  if (type === 'button' || type === 'pressable') return <button {...common} type="button" aria-label={p['aria-label'] || undefined} disabled={p.disabled} data-block={!!p.block} onClick={() => call('onClick')}>{children}</button>;
  if (type === 'icon') return <span {...common} aria-hidden="true">{({ 'rotate-ccw': '↺', plus: '+', minus: '−', 'chevron-down': '⌄', 'chevron-up': '⌃', 'check': '✓', 'sun': '☀', 'moon': '☾' })[p.name] || '·'}</span>;
  if (type === 'spacer') return <div {...common} aria-hidden="true" style={{...common.style, height: dimension(p.size ?? p.height ?? 16)}}/>;
  if (type === 'carousel-item') return <div {...common}>{children}</div>;
  if (type === 'divider') return <hr {...common} />;
  if (type === 'table') return <div className="intl-table-scroll"><table {...common}><tbody>{children}</tbody></table></div>;
  if (type === 'table-row') return <tr {...common}>{children}</tr>;
  if (type === 'table-cell') { const Tag = p.header ? 'th' : 'td'; return <Tag {...common} colSpan={p.colSpan} style={{ ...common.style, textAlign: p.align, verticalAlign: p.vAlign }}>{children}</Tag>; }
  if (type === 'chart') return <Chart {...p} {...common} />;
  if (type === 'code') return <pre {...common}><code>{children}</code></pre>;
  if (type === 'math') return <div {...common}><span className="intl-warning">{t.math}</span><code>{p.value}</code></div>;
  if (type === 'list') { const Tag = p.marker === 'number' ? 'ol' : 'ul'; return <Tag {...common}>{children}</Tag>; }
  const tag = { box: 'div', row: 'div', title: 'h3', text: 'div', caption: 'small', badge: 'span', bold: 'strong', italic: 'em', 'inline-code': 'code', label: 'div', grid: 'div', 'grid-item': 'div', card: 'div', 'list-item': 'li' }[type];
  if (tag) return React.createElement(tag, common, children);
  return <div className="intl-warning" role="status" data-unsupported={type}>{t.unsupported}: {type}{children}</div>;
}
