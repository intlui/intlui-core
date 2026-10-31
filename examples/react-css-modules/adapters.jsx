import React from 'react';
import styles from './host.module.css';

// These are host-owned components, not simulated third-party packages.
// Forward only known DOM attributes; never spread all model-generated props.
const attributes = props => ({className: `${styles.control} ${props.className || ''}`, style: props.style,
  'data-d-component': props['data-d-component'], 'aria-label': props['aria-label'], disabled: props.disabled});
export function Checkbox(props) {
  return <label className={styles.checkbox}>
    <input {...attributes(props)} type="checkbox" checked={props.checked === true}
      onChange={event => props.onChange(event.target.checked)}/>{props.children}
  </label>;
}
export function Input(props) {
  return <input {...attributes(props)} type="text" value={String(props.value ?? '')} placeholder={props.placeholder}
    onChange={event => props.onChange(event.target.value)}/>;
}
export function Slider(props) {
  return <label className={styles.range}><span>{props['aria-label']}: {props.value}</span>
    <input {...attributes(props)} type="range" value={props.value ?? 0} min={props.min} max={props.max} step={props.step}
      onChange={event => {const value = Number(event.target.value); if (Number.isFinite(value)) props.onChange(value);}}/>
  </label>;
}
export function Select(props) {
  return <select {...attributes(props)} value={String(props.value ?? '')} onChange={event => props.onChange(event.target.value)}>
    {(props.options || []).map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
  </select>;
}
// Stable component references: do not create adapters inside the streaming render.
export const adapters = {checkbox: Checkbox, input: Input, slider: Slider, select: Select};
