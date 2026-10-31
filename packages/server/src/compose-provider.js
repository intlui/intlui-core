// Composition is server configuration: never accept adapters from a request body.
export function composeProvider({ id, source, translator } = {}) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || id === 'deterministic') throw new TypeError('Invalid composed provider id');
  if (!translator || typeof translator.translate !== 'function') throw new TypeError('A translator adapter is required');
  if (source !== undefined && (!source || typeof source.generate !== 'function')) throw new TypeError('Invalid source adapter');
  const translate = translator.translate.bind(translator);
  const generate = source?.generate.bind(source);
  return Object.freeze({ id, modes: Object.freeze(generate ? ['translate', 'generate'] : ['translate']),
    translate, ...(generate ? { generate } : {}) });
}
