// Validate data crossing the worker boundary, independently of runtime checks.
export function validateSandboxMessage(message, maxSequence) {
  const invalid = () => {throw Error('Invalid sandbox message');};
  let values = 0, characters = 0;
  const ancestors = new Set();
  function inspect(value, depth = 0) {
    if (++values > 100000 || depth > 120) invalid();
    if (typeof value === 'string') {characters += value.length; if (characters > 1000000) invalid(); return;}
    if (value == null || ['number', 'boolean', 'undefined'].includes(typeof value)) return;
    if (typeof value !== 'object' || ancestors.has(value)) invalid();
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
    ancestors.add(value);
    for (const key of Object.keys(value)) {characters += key.length; if (characters > 1000000) invalid(); inspect(value[key], depth + 1);}
    ancestors.delete(value);
  }
  inspect(message);
  if (!message || Array.isArray(message) || typeof message !== 'object') invalid();
  if (!['ready', 'ack', 'snapshot', 'error', 'fatal'].includes(message.type)) invalid();
  if (message.type === 'ready') return;
  if (message.type === 'fatal') {if (typeof message.message !== 'string' || message.message.length > 4000) invalid(); return;}
  if (!Number.isSafeInteger(message.sequence) || message.sequence < 1 || message.sequence > maxSequence) invalid();
  if (message.type === 'error' && (typeof message.message !== 'string' || message.message.length > 4000)) invalid();
  if (message.type !== 'snapshot') return;
  if (message.diagnostics !== undefined && (!Array.isArray(message.diagnostics) || message.diagnostics.length > 100 || message.diagnostics.some(item => typeof item !== 'string' || item.length > 2000))) invalid();
  let nodes = 0;
  function tree(node, depth = 0) {
    if (++nodes > 12000 || depth > 80) invalid();
    if (node == null || ['string', 'number', 'boolean'].includes(typeof node)) return;
    if (Array.isArray(node)) {for (const child of node) tree(child, depth + 1); return;}
    if (typeof node !== 'object' || typeof node.type !== 'string' || node.type.length > 100 ||
      (node.props !== undefined && (!node.props || typeof node.props !== 'object' || Array.isArray(node.props)))) invalid();
    tree(node.children, depth + 1);
  }
  tree(message.tree);
}
