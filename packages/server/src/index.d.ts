import type {TurnRequest, LanguageProfile, JsonObject} from '@intlui/protocol';
export interface HistoryMessage {role:'user'|'assistant'; content:string}
export interface GenerationOptions {text:string; history?:HistoryMessage[]; signal:AbortSignal; onUsage?:(usage:unknown) => void}
export interface TranslationOptions {intent:string; capabilities:TurnRequest['capabilities']; profile?:LanguageProfile; instructions?:string; delta:string; blocks:unknown[]; sourceComplete:boolean; signal:AbortSignal; onUsage?:(usage:unknown) => void}
export interface ServerProfile<Artifact = unknown> {
  profile:LanguageProfile;
  instructions:string;
  compile(source:string,context:{signal:AbortSignal}):{artifact:Artifact; requiredComponents:string[]}|Promise<{artifact:Artifact; requiredComponents:string[]}>;
  /** Throw (or return false) to reject creation or an update. */
  validateData(artifact:Artifact,data:JsonObject,context:{signal:AbortSignal; previousAppData?:JsonObject}):void|boolean|Promise<void|boolean>;
}
export function createUiProfile():ServerProfile;
export interface ChatProvider {
  id:string;
  modes:readonly ('generate'|'translate')[];
  generate?:(options:GenerationOptions) => AsyncIterable<string>;
  translate:(options:TranslationOptions) => AsyncIterable<unknown>;
}
export interface StoredTurn {projectId:string; conversationId:string; turnId:string; profile?:LanguageProfile; mode:'generate'|'translate'; userText:string; text:string; previousTurnId?:string; status:'complete'|'partial'}
export interface ConversationStore {
  /** Atomic scoped request admission. False means already seen; do not retry it. */
  claim(userId:string, requestId:string):Promise<boolean>;
  /** Never return another user's turn. */
  get(userId:string, turnId:string):Promise<StoredTurn|null>;
  save(userId:string, turn:StoredTurn):Promise<void>;
}
export interface ChatLimits {
  maxBodyBytes:number; maxInputChars:number; maxConcurrentPerUser:number; maxConcurrent:number;
  timeoutMs:number; maxHistoryTurns:number; maxHistoryChars:number; intervalMs:number;
  flushMs:number; maxBatch:number; maxTranslations:number; maxOutputChars:number;
  initialBatchChars:number; initialFlushMs:number;
}
export interface ChatHandlerOptions {
  profiles?:ServerProfile<any>[];
  authorizeProfile?:(context:{identity:{userId:string}; profile:LanguageProfile; request:Request})=>boolean|Promise<boolean>;
  provider:ChatProvider;
  /** Verify your session; never trust identity supplied in the JSON body. */
  authenticate:(request:Request) => {userId:string}|null|Promise<{userId:string}|null>;
  store?:ConversationStore; projectId?:string; allowedOrigins?:string[]; limits?:Partial<ChatLimits>;
  onUsage?:(event:{userId:string; turnId:string; usage:unknown}) => void|Promise<void>;
}
export function createChatHandler(options:ChatHandlerOptions):(request:Request) => Promise<Response>;
export function createMemoryConversationStore(options?:{maxEntries?:number; maxBytes?:number; ttlMs?:number}):ConversationStore;
export interface OpenAiOptions {apiKey:string; model:string; translationModel?:string; instructions?:string; fetchImpl?:typeof fetch; timeoutMs?:number; maxOutputTokens?:number}
export function createOpenAiProvider(options:OpenAiOptions):ChatProvider;
export function composeProvider(options:{id:string; source?:{generate:NonNullable<ChatProvider['generate']>}; translator:Pick<ChatProvider,'translate'>}):ChatProvider;
