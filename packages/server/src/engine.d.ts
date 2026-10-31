import type {ChatProvider, ChatLimits, HistoryMessage, OpenAiOptions, ServerProfile} from './index.js';
import type {TurnRequest} from '@intlui/protocol';
export {createOpenAiProvider, composeProvider} from './index.js';
export function runTranslation(options:Pick<ChatLimits,'intervalMs'|'flushMs'|'maxBatch'|'maxTranslations'|'maxOutputChars'> & Partial<Pick<ChatLimits,'initialBatchChars'|'initialFlushMs'>> & {
  provider:ChatProvider; input:TurnRequest; profileAdapter?:ServerProfile<any>; history?:HistoryMessage[]; sourceStream?:AsyncIterable<string>; signal:AbortSignal;
  emit:(event:Record<string,unknown>) => void|Promise<void>; onUsage:(usage:unknown) => void;
}):Promise<'complete'|'partial'>;
export function validateSource(source:string):string[];
export function createStreamTranslator(options:OpenAiOptions):ChatProvider['translate'];
export const STREAM_INSTRUCTIONS:string;
export const DIL_INSTRUCTIONS:string;
export const TRANSLATION_CONTEXT_VERSION:number;
export const STREAM_DONE:unique symbol;
export function readJsonStream(body:AsyncIterable<Uint8Array>, format?:'ndjson'|'sse', options?:{includeDone?:boolean}):AsyncGenerator<any>;
export function abortableBytes(body:ReadableStream<Uint8Array>, signal?:AbortSignal):AsyncGenerator<Uint8Array>;
export function responseText(options:OpenAiOptions & {input:unknown; instructions:string; signal?:AbortSignal; onEvent?:(event:any) => void}):AsyncGenerator<string>;
export function createChatCompletionsSource(options:{endpoint:string; model:string; apiKey?:string; instructions?:string; fetchImpl?:typeof fetch; timeoutMs?:number; maxOutputTokens?:number; maxOutputChars?:number; includeUsage?:boolean; tokenParameter?:'max_completion_tokens'|'max_tokens'}):{generate:NonNullable<ChatProvider['generate']>};
