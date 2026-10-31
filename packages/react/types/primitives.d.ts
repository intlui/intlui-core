import type {Context, ReactNode, ReactElement} from 'react';
import type {DilAppearanceProps, DilHost} from './index.js';
export interface DilTreeNode {type:string; key?:string|number; props?:Record<string,unknown>; children?:DilTree}
export type DilTree = DilTreeNode | string | number | boolean | null | DilTree[];
export function Tree(props:{node:DilTree; dispatch:(id:number,...args:unknown[])=>void}):ReactNode;
export const AdapterContext:Context<DilAppearanceProps & {sequence?:number; messages?:Record<string,string>}>;
export const HostContext:Context<DilHost>;
export {ImageViewer} from './index.js';
export function safeLink(value:unknown):string|undefined;
export function svgProps(props:Record<string,unknown>,prefix:string):Record<string,string|number>;
export function chartModel(data:unknown,series:unknown,xAxis?:Record<string,unknown>,yAxis?:Record<string,unknown>):Record<string,unknown>|null;
