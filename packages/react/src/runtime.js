// Independent prototype runtime. This function is serialized into an isolated worker.
export function createRuntime(emit) {
  let artifact, environment = {}, entry, scope = 'root', slot = 0, serial = 0;
  let scheduled = false, disposed = false;
  const states = new Map();
  const callbacks = new Map();
  let callbackPaths = new Map(), nextCallbackPaths, nextCallbacks;
  let visited = new Set(), diagnostics = new Set();
  const error = e => emit({ type: 'error', message: String(e?.message || e) });
  const schedule = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; render(); });
  };
  const DIL = {
    render(node) { entry = node; },
    useState(initial, options = {}) {
      const key = `${scope}/state:${options.key ?? slot++}`;
      visited.add(key);
      if (!states.has(key)) states.set(key, typeof initial === 'function' ? initial() : initial);
      return [states.get(key), value => {
        const next = typeof value === 'function' ? value(states.get(key)) : value;
        if (!Object.is(next, states.get(key))) { states.set(key, next); schedule(); }
      }];
    },
    useConstants: () => artifact.constants || {},
    useAppData: selector => selector ? selector(artifact.appData || {}) : artifact.appData || {},
    useTheme: () => ({ theme: environment.theme || 'light', isDark: environment.theme === 'dark', isLight: environment.theme !== 'dark' }),
  };
  const api = new Proxy(DIL, { get(target, key) {
    if (key in target) return target[key];
    diagnostics.add(`Unsupported DIL API: ${String(key)}`);
    return () => { throw new Error(`Unsupported DIL API: ${String(key)}`); };
  } });
  const jsx = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
  const serialize = (value, path, depth = 0) => {
    if (depth > 40) throw new Error('Property nesting limit exceeded');
    if (typeof value === 'function') {
      const id = callbackPaths.get(path) ?? ++serial;
      nextCallbackPaths.set(path, id);
      nextCallbacks.set(id, value);
      return { $callback: id };
    }
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.map((v, i) => serialize(v, `${path}/${i}`, depth + 1));
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v, `${path}/${JSON.stringify(k)}`, depth + 1)]));
    return null;
  };
  let count = 0;
  function resolve(node, path = 'root', depth = 0) {
    if (++count > 12000 || depth > 80) throw new Error('Render tree limit exceeded');
    if (node == null || typeof node === 'boolean') return null;
    if (typeof node === 'string' || typeof node === 'number') return node;
    if (Array.isArray(node)) return node.map((child, i) => resolve(child, `${path}/${child?.props?.key ?? i}`, depth + 1));
    if (typeof node.type === 'function') {
      const previous = [scope, slot];
      scope = path; slot = 0;
      try { return resolve(node.type({ ...node.props, children: node.children }), `${path}/body`, depth + 1); }
      finally { [scope, slot] = previous; }
    }
    if (node.type === 'fragment') return resolve(node.children, path, depth + 1);
    if (typeof node.type !== 'string') throw new Error('Invalid element type');
    return { type: node.type, key: node.props.key ?? path, props: serialize(node.props, `${path}/${JSON.stringify(node.type)}`), children: resolve(node.children, path, depth + 1) };
  }
  function render() {
    if (!artifact || disposed) return;
    nextCallbacks = new Map(); nextCallbackPaths = new Map(); visited = new Set(); diagnostics = new Set(); count = 0;
    try {
      entry = null;
      // Called only in the sandbox worker (or explicit Node test harness).
      new Function('DIL', '__dil', `"use strict";\n${artifact.code}`)(api, { jsx, Fragment: 'fragment' });
      const tree = resolve(entry);
      callbacks.clear();
      for (const [id, callback] of nextCallbacks) callbacks.set(id, callback);
      callbackPaths = nextCallbackPaths;
      for (const key of states.keys()) if (!visited.has(key)) states.delete(key);
      emit({ type: 'snapshot', tree, diagnostics: [...diagnostics] });
    } catch (e) { callbacks.clear(); callbackPaths.clear(); error(e); }
  }
  return {
    load(payload, env = {}) {
      if (!payload || typeof payload.code !== 'string' || payload.code.length > 500000) throw new Error('Invalid compiled artifact');
      states.clear(); callbacks.clear(); callbackPaths.clear(); disposed = false; artifact = payload; environment = env; render();
    },
    update(env) { environment = env; render(); },
    updateData(data) { artifact = { ...artifact, appData: data }; render(); },
    trigger(id, args = []) {
      const callback = callbacks.get(id);
      if (!callback) { error(new Error('Expired callback')); return; }
      // Even a rejected/no-op input needs a snapshot so the host can retire
      // its optimistic value and restore the authoritative controlled prop.
      try { callback(...args); schedule(); } catch (e) { error(e); }
    },
    dispose() { disposed = true; states.clear(); callbacks.clear(); callbackPaths.clear(); artifact = null; }
  };
}
