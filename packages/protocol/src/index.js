import {validateLegacySurface} from './legacy-surfaces.js';
export const PROTOCOL_VERSION = '0.1';
export const EXTENSIBLE_PROTOCOL_VERSION = '0.2';
export const UI_PROFILE = Object.freeze({id:'intlui.ui', version:'0.1'});
const terminalStatuses = new Set(['complete', 'partial', 'cancelled', 'failed']);
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const fail = message => { throw new TypeError(message); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function object(value, name) { if (!record(value)) fail(`${name} must be an object`); }
function keys(value, allowed, name) {
  object(value, name);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name}: unknown field ${key}`);
}
function string(value, name, max = 30000, nonempty = true) {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail(`Invalid ${name}`);
}
function id(value, name) { if (typeof value !== 'string' || !idPattern.test(value)) fail(`Invalid ${name}`); }
function integer(value, name, minimum = 0) { if (!Number.isSafeInteger(value) || value < minimum) fail(`Invalid ${name}`); }
function version(value) { if (![PROTOCOL_VERSION, EXTENSIBLE_PROTOCOL_VERSION].includes(value)) fail('Unsupported protocol version'); }
export function validateProfile(value) {
  keys(value, ['id','version'], 'profile'); id(value.id, 'profile.id'); id(value.version, 'profile.version');
  return value;
}
export function profileKey(value) { validateProfile(value); return JSON.stringify([value.id,value.version]); }
export function sameProfile(left, right) { return profileKey(left) === profileKey(right); }
function profileVersion(protocolVersion, profile) {
  version(protocolVersion);
  if (profile !== undefined) validateProfile(profile);
}
function jsonObject(value, name) {
  object(value, name);
  let nodes = 0;
  function walk(item, depth) {
    if (++nodes > 10000 || depth > 24) fail(`${name} exceeds JSON complexity limit`);
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!Array.isArray(item) && !record(item)) fail(`${name} must contain JSON values`);
    for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail(`${name} contains reserved key`);
      walk(child, depth + 1);
    }
  }
  walk(value, 0);
  if (JSON.stringify(value).length > 60000) fail(`${name} exceeds JSON size limit`);
}
function names(values, name, max = 64) {
  if (!Array.isArray(values) || values.length > max || new Set(values).size !== values.length) fail(`Invalid ${name}`);
  for (const value of values) id(value, name);
}

export function validateCapabilities(value, protocolVersion = EXTENSIBLE_PROTOCOL_VERSION) {
  version(protocolVersion);
  keys(value, ['surface', 'formats', 'components', 'profile'], 'capabilities');
  if (value.profile !== undefined) validateProfile(value.profile);
  id(value.surface, 'surface');
  names(value.formats, 'formats', 1);
  if (value.formats.some(format => format !== 'dil')) fail('Unsupported UI format');
  names(value.components, 'components', 128);
  if (protocolVersion === '0.1') validateLegacySurface(value);
  if (!value.formats.length && value.components.length) fail('Components require a UI format');
  return value;
}

export function validateRequest(value) {
  keys(value, ['version', 'requestId', 'intent', 'input', 'capabilities', 'previousTurnId'], 'request');
  version(value.version); id(value.requestId, 'requestId'); string(value.intent, 'intent');
  keys(value.input, ['mode', 'text'], 'input');
  if (!['generate', 'translate', 'translate-stream'].includes(value.input.mode)) fail('Unsupported input mode');
  if (value.previousTurnId !== undefined) {
    id(value.previousTurnId, 'previousTurnId');
    if (value.input.mode !== 'generate') fail('Conversation context requires generate mode');
  }
  if (value.input.mode === 'translate-stream') { if (value.input.text !== '') fail('Streaming input starts empty'); }
  else string(value.input.text, 'input.text'); validateCapabilities(value.capabilities, value.version);
  profileVersion(value.version, value.capabilities.profile);
  return value;
}

// The server constructs this AFTER verifying credentials and project membership.
// This function only validates shape; it does not verify identity or permissions.
export function validateResolvedContext(value) {
  keys(value, ['organizationId', 'projectId', 'principalId', 'environment'], 'resolved context');
  for (const field of ['organizationId', 'projectId', 'principalId']) id(value[field], field);
  if (!['development', 'production'].includes(value.environment)) fail('Invalid environment');
  return value;
}

export function validateBlock(block) {
  keys(block, ['id', 'format', 'source', 'appData', 'revision', 'requiredComponents', 'profile'], 'block');
  if (block.profile !== undefined) validateProfile(block.profile);
  id(block.id, 'block.id');
  if (block.format !== 'dil') fail('Unsupported block format');
  string(block.source, 'block.source', 50000); jsonObject(block.appData, 'block.appData');
  integer(block.revision, 'block.revision', 1); names(block.requiredComponents, 'requiredComponents', 128);
  return block;
}

export function supportsBlock(capabilities, block) {
  validateCapabilities(capabilities); validateBlock(block);
  return sameProfile(capabilities.profile ?? UI_PROFILE, block.profile ?? UI_PROFILE) &&
    (capabilities.profile === undefined) === (block.profile === undefined) &&
    capabilities.formats.includes(block.format) && block.requiredComponents.every(name => capabilities.components.includes(name));
}

export function validateEvent(event) {
  const envelope = ['version', 'projectId', 'conversationId', 'turnId', 'sequence', 'turnRevision', 'type'];
  const fields = {
    'text.delta': ['text'], 'turn.reset': ['text'], 'ui.create': ['block'],
    'ui.data': ['id', 'revision', 'appData'], 'ui.remove': ['id'],
    'status': ['status'], 'error': ['code', 'message', 'blockId'],
    'turn.end': ['status', 'reason']
  };
  object(event, 'event');
  if (!Object.hasOwn(fields, event.type)) fail('Unsupported event type');
  keys(event, [...envelope, ...fields[event.type]], 'event');
  version(event.version);
  for (const field of ['projectId', 'conversationId', 'turnId']) id(event[field], field);
  integer(event.sequence, 'sequence', 1); integer(event.turnRevision, 'turnRevision');
  if (event.type === 'text.delta' || event.type === 'turn.reset') string(event.text, 'text', 30000, false);
  if (event.type === 'ui.create') {validateBlock(event.block); profileVersion(event.version,event.block.profile);}
  if (event.type === 'ui.data') { id(event.id, 'id'); integer(event.revision, 'revision', 2); jsonObject(event.appData, 'appData'); }
  if (event.type === 'ui.remove') id(event.id, 'id');
  if (event.type === 'status' && !['receiving', 'translating'].includes(event.status)) fail('Invalid active status');
  if (event.type === 'error') {
    id(event.code, 'error.code'); string(event.message, 'error.message', 2000);
    if (event.blockId !== undefined) id(event.blockId, 'blockId');
  }
  if (event.type === 'turn.end') {
    if (!terminalStatuses.has(event.status)) fail('Invalid terminal status');
    if (event.status !== 'complete' || event.reason !== undefined) string(event.reason, 'reason', 2000);
  }
  return event;
}

export function createTurnState(scope, capabilities, protocolVersion = PROTOCOL_VERSION) {
  keys(scope, ['projectId', 'conversationId', 'turnId'], 'scope');
  for (const field of ['projectId', 'conversationId', 'turnId']) id(scope[field], field);
  validateCapabilities(capabilities, protocolVersion);
  profileVersion(protocolVersion, capabilities.profile);
  return { ...scope, ...(protocolVersion !== PROTOCOL_VERSION ? {protocolVersion} : {}), capabilities: structuredClone(capabilities), sequence: 0, turnRevision: 0,
    text: '', blocks: [], status: 'receiving', errors: [], terminal: false, reason: null };
}

// Replicated server data only. User state belongs to the renderer, keyed by block
// identity; it is intentionally not part of this reducer or overwritten by data.
export function reduceEvent(state, event) {
  validateEvent(event);
  if (event.version !== (state.protocolVersion ?? PROTOCOL_VERSION)) fail('Event protocol version mismatch');
  for (const field of ['projectId', 'conversationId', 'turnId']) if (event[field] !== state[field]) fail(`Event ${field} mismatch`);
  if (state.terminal) fail('Turn already ended');
  if (event.sequence !== state.sequence + 1) fail('Unexpected event sequence');
  const resetting = event.type === 'turn.reset';
  if (event.turnRevision !== state.turnRevision + (resetting ? 1 : 0)) fail('Unexpected turn revision');
  const next = { ...state, sequence: event.sequence };
  if (resetting) return { ...next, turnRevision: event.turnRevision, text: event.text, blocks: [], errors: [], status: 'receiving' };
  if (event.type === 'text.delta') {
    next.text += event.text;
    if (next.text.length > 30000) fail('Turn text limit');
  }
  if (event.type === 'ui.create') {
    if (state.blocks.length >= 24 || state.blocks.some(block => block.id === event.block.id)) fail('Duplicate block or block limit');
    if (event.block.revision !== 1) fail('New block must start at revision 1');
    if (!supportsBlock(state.capabilities, event.block)) fail('Unsupported client capability; server must send text fallback');
    next.blocks = [...state.blocks, structuredClone(event.block)];
  }
  if (event.type === 'ui.data' || event.type === 'ui.remove') {
    const previous = state.blocks.find(block => block.id === event.id);
    if (!previous) fail('Unknown block');
    if (event.type === 'ui.remove') next.blocks = state.blocks.filter(block => block.id !== event.id);
    else {
      if (event.revision !== previous.revision + 1) fail('Unexpected block revision');
      next.blocks = state.blocks.map(block => block.id === event.id ? { ...block, revision: event.revision, appData: structuredClone(event.appData) } : block);
    }
  }
  // State is immutable: unchanged blocks have already passed this limit. Text,
  // status and terminal events must not serialize the entire UI again.
  if (next.blocks !== state.blocks && JSON.stringify(next.blocks).length > 200000) fail('Turn UI size limit');
  if (event.type === 'status') next.status = event.status;
  if (event.type === 'error') {
    if (state.errors.length >= 100) fail('Turn error limit');
    next.errors = [...state.errors, { code: event.code, message: event.message, ...(event.blockId ? { blockId: event.blockId } : {}) }];
  }
  if (event.type === 'turn.end') {
    next.status = event.status; next.terminal = true; next.reason = event.reason ?? null;
  }
  return next;
}

export function validateInputFrame(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['sequence', 'text', 'end'].includes(key)) ||
      !Number.isSafeInteger(value.sequence) || value.sequence < 1 || typeof value.text !== 'string' || value.text.length > 4096 ||
      typeof value.end !== 'boolean' || (!value.text.length && !value.end)) throw new TypeError('Invalid input frame');
  return {sequence: value.sequence, text: value.text, end: value.end};
}
