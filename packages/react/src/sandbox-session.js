// Host-side transport lifecycle. No generated code runs in this module.
import {validateSandboxMessage} from './sandbox-message.js';
export function createSandboxSession({ port, getInitialLoad, onView, onClose,
  timeoutMs = 4000, startupTimeoutMs = 12000 }) {
  let closed = false, ready = false, sequence = 0;
  const pending = new Map();
  const bootTimer = setTimeout(() => fail('Sandbox unavailable within the startup timeout.'), startupTimeoutMs);
  function dispose() {
    if (closed) return;
    closed = true; ready = false;
    clearTimeout(bootTimer);
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear(); port.onmessage = null; port.close(); onClose();
  }
  function fail(message) {
    if (closed) return;
    dispose();
    onView({ tree: null, diagnostics: [], loading: false, error: message });
  }
  function post(message) {
    if (closed || !ready) return;
    const id = ++sequence;
    pending.set(id, setTimeout(() => fail('Execution stopped: time limit exceeded.'), timeoutMs));
    try { port.postMessage({ ...message, sequence: id }); }
    catch (error) { fail(`Sending to sandbox failed: ${error.message}`); return; }
    return id;
  }
  port.onmessage = ({ data }) => {
    if (closed) return;
    try {validateSandboxMessage(data, sequence);} catch {fail('Invalid or oversized sandbox message.'); return;}
    if (data.type === 'ready') {
      if (ready) return;
      clearTimeout(bootTimer); ready = true;
      post({ type: 'load', ...getInitialLoad() });
    }
    if (data.type === 'ack') { clearTimeout(pending.get(data.sequence)); pending.delete(data.sequence); }
    if (data.type === 'snapshot') onView({ tree: data.tree, sequence: data.sequence, diagnostics: data.diagnostics || [], error: null, loading: false });
    // A recoverable render error hides stale controls; later valid data can recover.
    if (data.type === 'error') onView({ tree: null, diagnostics: [], sequence: data.sequence, error: data.message, loading: false });
    if (data.type === 'fatal') fail(data.message);
  };
  return { post, fail, dispose };
}
