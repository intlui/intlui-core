import type { ComponentType, CSSProperties, ReactElement, ReactNode } from 'react';
import type { JsonObject, JsonValue, TurnScope, TurnState, LanguageProfile, Capabilities, ProtocolVersion } from '@intlui/protocol';
import type { DilArtifact } from './compiler.js';
export * from './compiler.js';
export * from './capabilities.js';

export interface ProfileArtifact<T = unknown> {readonly profile:LanguageProfile; readonly value:T}
export interface RendererProfile<T = unknown> {
  profile:LanguageProfile;
  components:string[];
  compile(source:string):{artifact:T; requiredComponents:string[]; diagnostics?:import('./compiler.js').DilDiagnostic[]};
  /** Synchronous validation; throw or return false to reject data. */
  validateData(artifact:T,data:JsonObject):void|boolean;
  Renderer:ComponentType<DilRuntimeProps & {artifact:ProfileArtifact<T>}>;
}
export interface RendererProfiles {
  resolve(profile:LanguageProfile):RendererProfile<any>;
  capabilities(profile:LanguageProfile,options?:{surface?:string; components?:string[]}):Capabilities & {profile:LanguageProfile};
  compile(profile:LanguageProfile,source:string):{artifact:ProfileArtifact; diagnostics:import('./compiler.js').DilDiagnostic[]; Renderer:RendererProfile<any>['Renderer']; adapter:RendererProfile<any>};
}
export function createRendererProfiles(entries?:RendererProfile<any>[]):RendererProfiles;

export interface IntluiChatOptions {
  /** Select 0.2 for extensible surfaces; defaults to 0.1 for existing peers. */
  protocolVersion?:ProtocolVersion;
  endpoint?:string; apiBaseUrl?:string; token?:string; projectId?:string;
  /** Change when the authenticated session changes to discard the previous conversation. */
  sessionKey?:string; mode?:'generate'|'translate'; intent?:string; maxTurns?:number;
  capabilities?:TurnState['capabilities']; fetchImpl?:typeof fetch;
}
export interface IntluiChatItem {id:string; prompt:string; state:TurnState|null; interruption?:'cancelled'|'disconnected'}
export interface IntluiChat {
  items:IntluiChatItem[]; busy:boolean; error:Error|null; contextLost:boolean;
  /** Rejects on transport/admission errors; received content remains in items. */
  send(text:string):Promise<TurnState>;
  stop():void; reset():void;
}
export function useIntluiChat(options?:IntluiChatOptions):IntluiChat;

/** Trusted host adapter props; arbitrary DIL properties require narrowing. */
export interface DilAdapterProps<Value = JsonValue> {
  children?: ReactNode;
  className: string;
  style: CSSProperties;
  'data-d-component': string;
  'aria-label'?: string;
  disabled?: boolean;
  onChange: (value: Value) => void;
  onClick: () => void;
  [property: string]: unknown;
}
export interface CheckboxAdapterProps extends DilAdapterProps<boolean> { checked?: boolean }
export interface InputAdapterProps extends DilAdapterProps<string> { value?: string; placeholder?: string; inputType?: 'text' | 'number' | 'email' }
export interface SliderAdapterProps extends DilAdapterProps<number> { value?: number; min?: number; max?: number; step?: number }
export interface SelectAdapterProps extends DilAdapterProps<string> { value?: string; options?: { value: string; label: string; disabled?: boolean }[] }
export interface ChartAdapterProps extends DilAdapterProps {
  data?: JsonObject[];
  series?: { type: string; dataKey: string; label?: string }[];
  xAxis?: { dataKey?: string; label?: string; scale?:'linear'; min?:number; max?:number };
  yAxis?: {label?:string; min?:number; max?:number};
  meta?: {footer?:string};
  height?: number | string;
}
/** Extend this interface by module augmentation for custom semantic components. */
export interface DilAdapterPropMap {
  checkbox: CheckboxAdapterProps;
  input: InputAdapterProps;
  slider: SliderAdapterProps;
  select: SelectAdapterProps;
  'segmented-control': SelectAdapterProps;
  button: DilAdapterProps;
  pressable: DilAdapterProps;
  chart: ChartAdapterProps;
  box: DilAdapterProps; row: DilAdapterProps; grid: DilAdapterProps; 'grid-item': DilAdapterProps;
  card: DilAdapterProps; title: DilAdapterProps; text: DilAdapterProps; caption: DilAdapterProps;
  badge: DilAdapterProps; bold: DilAdapterProps; italic: DilAdapterProps; 'inline-code': DilAdapterProps;
  label: DilAdapterProps; icon: DilAdapterProps; divider: DilAdapterProps;
  table: DilAdapterProps; 'table-row': DilAdapterProps; 'table-cell': DilAdapterProps;
  code: DilAdapterProps; math: DilAdapterProps; list: DilAdapterProps; 'list-item': DilAdapterProps;
  form: DilAdapterProps; textarea: InputAdapterProps; 'date-picker': InputAdapterProps;
  radio: DilAdapterProps; 'radio-group': DilAdapterProps; spacer: DilAdapterProps;
  carousel: DilAdapterProps; 'carousel-item': DilAdapterProps; Link: DilAdapterProps;
  AsyncImage: DilAdapterProps; Cite: DilAdapterProps; Entity: DilAdapterProps; svg: DilAdapterProps;
  timer: DilAdapterProps; 'file-input': DilAdapterProps; download: DilAdapterProps;
  audio: DilAdapterProps; video: DilAdapterProps; 'drag-board': DilAdapterProps;
  'webgl-scene': DilAdapterProps; 'geo-map': DilAdapterProps;
  'local-store': DilAdapterProps; 'data-source': DilAdapterProps;
}
export type DilComponents = { [Name in keyof DilAdapterPropMap]?: ComponentType<DilAdapterPropMap[Name]> };
export type DilClassNames = Partial<Record<keyof DilAdapterPropMap, string>>;
export interface DilAppearanceProps {
  profiles?:RendererProfiles;
  host?: DilHost;
  theme?: 'light' | 'dark';
  /** Language attribute, default en. Built-in labels remain English; content is preserved. */
  locale?: string;
  components?: DilComponents;
  classNames?: DilClassNames;
}
export interface DilImageAsset {src:string; alt?:string; title?:string}
export interface DilHost {
  resolveImage?:(query:{ref?:string; query?:string; group?:string},options:{signal:AbortSignal})=>DilImageAsset|Promise<DilImageAsset>;
  references?:Record<string,{url:string; title?:string}>;
  onOpenImage?:(asset:DilImageAsset)=>void;
}
export function ImageViewer(props:{asset?:DilImageAsset|null; onClose:()=>void}):ReactElement|null;
export interface IntluiProviderProps extends DilAppearanceProps { children?: ReactNode }
/** Inherit appearance by component name; local properties override inherited values. */
export function IntluiProvider(props: IntluiProviderProps): ReactElement;
export function turnStatusLabel(status: TurnState['status'], locale?: string): string;
export interface DilRuntimeProps extends DilAppearanceProps {
  appData?: JsonObject;
  timeoutMs?: number;
  startupTimeoutMs?: number;
  onError?: (message: string) => void;
  /** Rendering opportunity after two animation frames, not guaranteed paint. */
  onRendered?: () => void;
}
export interface DilSourceProps extends DilRuntimeProps { source: string; profile?:LanguageProfile }
export interface DilRendererProps extends DilRuntimeProps { artifact: DilArtifact }
export interface IntluiAnswerProps extends DilAppearanceProps {
  /** Local transport outcome; does not alter replicated server state. Ignored for terminal turns. */
  interruption?: 'cancelled' | 'disconnected';
  state?: TurnState | null;
  onRendered?: (event: { blockId: string; revision: number }) => void;
}
export function DilSource(props: DilSourceProps): ReactElement;
export function DilRenderer(props: DilRendererProps): ReactElement;
export function IntluiAnswer(props: IntluiAnswerProps): ReactElement | null;
export function blockIdentity(state: TurnScope & { turnRevision: number }, blockId: string): string;
