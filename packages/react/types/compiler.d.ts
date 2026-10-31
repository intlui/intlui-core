import type { Node, Program } from 'acorn';
import type { JsonObject } from '@intlui/protocol';

export interface DilExpression { type: 'Expression'; raw: string; start: number; end: number; expression: Node }
export interface DilBody { type: 'Body'; raw: string; start: number; end: number; directiveStart: number; program: Program }
export interface DilElement {
  type: 'Element'; tag: string; start: number; end: number;
  attributes: { name: string; start:number; end:number; value: DilExpression | { type: 'Literal'; value: string | number | true; start?:number; end?:number } }[];
  children: DilNode[];
}
export type DilNode = DilExpression | DilBody | DilElement
  | { type: 'Text'; value: string; start: number }
  | { type: 'RawText'; value: string }
  | { type: 'Math'; value: string; block: boolean; start: number }
  | { type: 'If'; start: number; end: number; test: DilExpression; consequent: DilNode[]; alternate: DilNode[] }
  | { type: 'Each'; start: number; end: number; collection: { raw: string; expression: Node }; aliases: string; children: DilNode[] };
export interface DilDocument { type: 'Document'; start: 0; end: number; children: DilNode[] }
export interface DilDiagnostic { severity: 'warning' | 'info'; message: string; code?:string; component?:string; start?:number; end?:number }
/** Trusted compiler output. Supplying an artifact is not a security boundary. */
export interface DilArtifact {
  code: string;
  constants: JsonObject;
  appData: JsonObject;
  fallbackMarkdown: string;
  fallbackMarkdownVersion: 1;
}
export interface DilCompilation {
  ast: DilDocument;
  diagnostics: DilDiagnostic[];
  requiredComponents: string[];
  payload: DilArtifact;
}
export class DilSyntaxError extends SyntaxError {
  constructor(message: string, source: string, offset: number);
  offset: number;
  line: number;
  column: number;
}
export function parseDil(source: string): DilDocument;
export function compileDil(source: string, options?: { appData?: JsonObject }): DilCompilation;
