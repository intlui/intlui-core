import { DIL_INSTRUCTIONS } from './dil-prompt.js';
import { responseText } from './stream-transport.js';

export const TRANSLATION_CONTEXT_VERSION = 4;

const PROFILE_OPERATIONS = `Return NDJSON operations, one JSON object per line, without fences.
Translate only supplied delta and existing blocks; preserve facts and qualifications. Do not answer the user yourself.
Create: {"type":"create","id":"stable-id","source":"complete profile source","appData":{}}.
Update: {"type":"data","id":"existing-id","appData":{}} replaces the entire data object.
Remove: {"type":"remove","id":"existing-id"}. Never reuse an id or replace its source.
The source grammar and data contract are defined by the registered profile below.
Use only capabilities.components. If useful UI is impossible, return no operations; original text remains visible.
Do not emit profile identifiers or choose another grammar. All blocks belong to the selected profile.
`;

export const STREAM_INSTRUCTIONS = `${DIL_INSTRUCTIONS}
OVERRIDE OUTPUT FORMAT: Return NDJSON, one complete JSON operation per line, no fences.
You incrementally translate text arriving from another model into UI. Never answer the question yourself.
Input contains delta (new text, possibly an unfinished phrase) and blocks (current UI).
When capabilities is present, capabilities.components is the exhaustive list of supported component names (case-sensitive), including containers and components introduced by Markdown. Use only those components, even when the examples or requested presentation use others. capabilities.surface identifies the host, not additional permissions. If the requested control is unavailable, present the supplied facts with supported components; never simulate an unavailable action or invent data. If no useful supported UI is possible, emit no operations: the original text is already visible. If capabilities.formats does not include dil, emit no operations.
Input also contains intent: the user's requested presentation or task. Use intent to choose the UI, not as evidence for facts missing from delta and blocks. Never answer it yourself.
sourceComplete is true only when this batch includes the end of the source. False does not mean a sentence is incomplete; it only means more source may arrive. Never add filler to complete a fragment.
Preserve all facts, numbers, units, citations and qualifications. Never infer a missing continuation.
Allowed operations:
{"type":"create","id":"stable-id","source":"complete DIL source","appData":{}}
{"type":"data","id":"existing-id","appData":{}}
{"type":"remove","id":"existing-id"}
Each operation is independently complete. Only create new ids, never overwrite a source.
Use DIL.useAppData() to read changeable content. Data operations replace the FULL data object, so include existing information.
Keep user interaction state in DIL.useState and never put incoming content into a useState initializer.
Use stable keys for list items. Each block is isolated and cannot access another block's state.
Prefer extending data of an existing block. At most 24 blocks. Do not repeat already rendered text unnecessarily.
FIRST USEFUL UI: The original text is already shown independently. Do not spend an operation copying an introduction into a separate text-only block before the requested UI. As soon as there is one complete task, inventory row, or chart datum, emit the smallest usable requested block FIRST, before introductory updates or supplementary notes. A single real item is enough; do not wait for the full list. Never create empty controls just to appear interactive and never invent missing fields. Preserve earlier context/qualifications in the block data or, if no useful item exists yet, in a compact context block.
An early text-only introduction must not lock the whole answer into plain text. Once enough complete facts arrive, create a NEW structured block with a stable id alongside existing blocks: checkboxes for a requested checklist, or a searchable table for a requested inventory. Do not invent rows, quantities, completion, dates or permissions to fill controls.
Keep interactive block source and ids stable thereafter; update their full appData and preserve useState, stable item keys and filter state. Never remove/recreate an interactive block to change its layout. A text introduction may remain for context; update its data to keep introductory facts and qualifications without duplicating all structured rows. Keep late qualifications visible.
INCOMPLETE FRAGMENTS: Keep a fragment only when actual received text is unfinished. Store it in appData.pending as a string, empty when resolved. From the first creation, put BOTH its caption and text inside {#if data.pending}...{/if}. Never use a permanent incomplete/loading caption, or sentinel strings such as "None", "Complete", or "Nessuno". Resolve prior fragments with each new delta, retain all their facts elsewhere, and set pending="" when nothing is unfinished. If the source ends on a genuinely unfinished fragment, preserve that fragment and its qualification rather than inventing a continuation. Do not display source-stream completion as an always-visible incomplete warning.
Use ordinary text when interactivity would require invented formulas. No external actions.
Do not output program fragments; every source must compile on its own.
`;

export function createStreamTranslator(settings) {
  return async function* translate({ intent = '', capabilities, profile, instructions, delta, blocks, sourceComplete = false, signal, onUsage = () => {} }) {
    const combined = AbortSignal.any([signal, AbortSignal.timeout(settings.timeoutMs || 60000)]);
    let buffer = '';
    for await (const token of responseText({ ...settings, signal: combined, instructions: instructions ? PROFILE_OPERATIONS + instructions : settings.instructions || STREAM_INSTRUCTIONS,
      onEvent: event => { if (event.stage === 'completed') onUsage(event.usage); },
      input: [{ role: 'user', content: JSON.stringify({ intent, capabilities, profile, delta, blocks, sourceComplete }) }] })) {
      buffer += token;
      if (buffer.length > 100000) throw Error('UI operation too large');
      let boundary;
      while ((boundary = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, boundary).trim(); buffer = buffer.slice(boundary + 1);
        if (line) yield JSON.parse(line);
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer);
  };
}
