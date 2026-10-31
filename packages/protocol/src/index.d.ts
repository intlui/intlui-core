export const PROTOCOL_VERSION: '0.1';
export type ProtocolVersion = '0.1';
export interface LanguageProfile {readonly id:string; readonly version:string}
export const UI_PROFILE: Readonly<LanguageProfile>;
export function validateProfile(value:unknown):LanguageProfile;
export function profileKey(value:LanguageProfile):string;
export function sameProfile(left:LanguageProfile,right:LanguageProfile):boolean;
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export type Capabilities = {profile?:LanguageProfile} & (
  | { surface: 'react' | 'widget'; formats: ['dil']; components: string[] }
  | { surface: 'react' | 'widget' | 'shopify-account' | 'text'; formats: []; components: [] });
export interface TurnRequestBody {
  requestId: string;
  /** Server-owned completed generation turn; authorization is checked by the API. */
  previousTurnId?: string;
  intent: string;
  input: { mode: 'generate' | 'translate' | 'translate-stream'; text: string };
}
export type TurnRequest = TurnRequestBody & {version:'0.1'; capabilities:Capabilities};
/** Shape only: this does not authenticate the principal or authorize access. */
export interface ResolvedContext {
  organizationId: string;
  projectId: string;
  principalId: string;
  environment: 'development' | 'production';
}
export interface DilBlock {
  profile?:LanguageProfile;
  id: string;
  format: 'dil';
  source: string;
  appData: JsonObject;
  revision: number;
  requiredComponents: string[];
}
export interface TurnScope { projectId: string; conversationId: string; turnId: string }
export type ActiveStatus = 'receiving' | 'translating';
export type TerminalStatus = 'complete' | 'partial' | 'cancelled' | 'failed';
export interface TurnError { code: string; message: string; blockId?: string }
export interface EventEnvelope extends TurnScope {
  version: ProtocolVersion;
  sequence: number;
  turnRevision: number;
}
export type TurnEvent = EventEnvelope & (
  | { type: 'text.delta'; text: string }
  | { type: 'turn.reset'; text: string }
  | { type: 'ui.create'; block: DilBlock }
  | { type: 'ui.data'; id: string; revision: number; appData: JsonObject }
  | { type: 'ui.remove'; id: string }
  | { type: 'status'; status: ActiveStatus }
  | ({ type: 'error' } & TurnError)
  | { type: 'turn.end'; status: 'complete'; reason?: string }
  | { type: 'turn.end'; status: Exclude<TerminalStatus, 'complete'>; reason: string }
);
export interface TurnState extends TurnScope {
  protocolVersion?:ProtocolVersion;
  capabilities: Capabilities;
  sequence: number;
  turnRevision: number;
  text: string;
  blocks: DilBlock[];
  status: ActiveStatus | TerminalStatus;
  errors: TurnError[];
  terminal: boolean;
  reason: string | null;
}
/** Validators return the validated value or throw TypeError; use the return value to narrow unknown data. */
export function validateCapabilities(value: unknown): Capabilities;
export function validateRequest(value: unknown): TurnRequest;
export function validateResolvedContext(value: unknown): ResolvedContext;
export function validateBlock(value: unknown): DilBlock;
export function validateEvent(value: unknown): TurnEvent;
export function supportsBlock(capabilities: Capabilities, block: DilBlock): boolean;
export function createTurnState(scope: TurnScope, capabilities: Capabilities, protocolVersion?:ProtocolVersion): TurnState;
export function reduceEvent(state: TurnState, event: TurnEvent): TurnState;

/** Ordered input chunk for a translate-stream turn. Only the latest accepted chunk can be replayed. */
export interface InputFrame { sequence: number; text: string; end: boolean }
export function validateInputFrame(value: unknown): InputFrame;
