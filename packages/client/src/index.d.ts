import type { TurnRequest, TurnState, TurnEvent, InputFrame } from '@intlui/protocol';
export class IntluiHttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code?: string);
}
export interface StartTurnOptions {
  /** HTTP(S) origin, or empty string / slash for browser same-origin. */
  apiBaseUrl?: string;
  /** Custom chat route: absolute HTTP(S) URL or same-origin /path. Mutually exclusive with apiBaseUrl. */
  endpoint?: string;
  /** Short-lived IntlUI session credential, never a model provider key. */
  token?: string;
  request: TurnRequest;
  /** If supplied, reject a stream from a different project before delivery. */
  projectId?: string;
  signal?: AbortSignal;
  onState?: (state: TurnState) => void;
  fetchImpl?: typeof fetch;
}
export function startTurn(options: StartTurnOptions): Promise<TurnState>;
export function readEvents(body: ReadableStream<Uint8Array> | null, options?: { signal?: AbortSignal }): AsyncGenerator<TurnEvent, void, unknown>;

export interface AppendInputOptions {
  apiBaseUrl?: string;
  token: string;
  turnId: string;
  frame: InputFrame;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}
export function appendInput(options: AppendInputOptions): Promise<{turnId: string; replayed: boolean; nextSequence: number}>;

export interface TranslateTextStreamOptions extends Omit<StartTurnOptions, 'request' | 'endpoint' | 'token'> {
  token: string;
  request: Omit<TurnRequest, 'input' | 'previousTurnId'> & {input: {mode: 'translate-stream'; text: ''}};
  /** The adapter must honor signal to release upstream resources. */
  source: (options: {signal: AbortSignal}) => AsyncIterable<string>;
  /** UTF-16 characters per frame, 2..4096 (default 1024). */
  chunkChars?: number;
  /** Maximum batching wait in ms, 0..2000 (default 100); 0 disables coalescing. */
  flushMs?: number;
}
export function translateTextStream(options: TranslateTextStreamOptions): Promise<TurnState>;

export interface TextSource extends AsyncIterable<string> {
  /** Throws and fails the source on overflow or non-string input. */
  push(text: string): void;
  /** Finish after draining accepted text. */
  end(): void;
  /** Drain accepted text, then reject the consumer. */
  fail(error: Error): void;
  readonly bufferedChars: number;
  readonly closed: boolean;
}
/** Single consumer; abort/iterator return discard queued text. Limits count UTF-16 characters. */
export function createTextSource(options?: {signal?: AbortSignal; maxBufferedChars?: number; maxBufferedChunks?: number}): TextSource;

export interface TranscriptEvent { sequence: number; text: string; final: boolean }
export interface TranscriptSource extends AsyncIterable<string> {
  /** Only exact replay of the last finalized segment is accepted. Invalid input fails the source. */
  push(event: TranscriptEvent): {committed: boolean; replayed: boolean; nextSequence: number};
  /** Rejects an unfinished provisional segment; finalize it explicitly, possibly with empty text. */
  end(): void;
  fail(error: Error): void;
  readonly pendingText: string;
  readonly nextSequence: number;
  readonly closed: boolean;
  readonly bufferedChars: number;
}
/** Provider-neutral ordered utterances, not audio transport or playback synchronization. */
export function createTranscriptSource(options?: {signal?: AbortSignal; maxSegmentChars?: number; separator?: string; maxBufferedChars?: number; maxBufferedChunks?: number}): TranscriptSource;

export interface OpenAIRealtimeSource extends AsyncIterable<string> {
  /** Already-decoded server event. False means unrelated or an exact duplicate; malformed selected events fail the source. */
  push(event: unknown): boolean;
  /** Report transport closure; throws unless a successful response.done already ended this source. */
  end(): void;
  fail(error: Error): void;
  readonly closed: boolean;
  readonly bufferedChars: number;
}
/** Assistant output transcript only. No audio, credentials, session creation, playback clock or reconnection. */
export function createOpenAIRealtimeSource(options: {responseId: string; itemId: string; outputIndex?: number; contentIndex?: number;
  signal?: AbortSignal; maxTextChars?: number; maxEvents?: number; maxBufferedChars?: number; maxBufferedChunks?: number}): OpenAIRealtimeSource;

export interface OpenAIRealtimeSubscription extends AsyncIterable<string> {
  /** Local abort and listener cleanup only; never closes the caller's transport or sends a remote cancel. */
  dispose(): void;
  fail(error: Error): void;
  readonly closed: boolean;
  readonly bufferedChars: number;
}
/** Attach before the first selected delta; ordered JSON string message events are required. */
export function subscribeOpenAIRealtimeSource(options: Parameters<typeof createOpenAIRealtimeSource>[0] & {
  transport: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {readonly readyState: number | string};
  maxMessageChars?: number;
}): OpenAIRealtimeSubscription;
