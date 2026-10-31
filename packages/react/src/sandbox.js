import { createRuntime } from './runtime.js';

function workerMain(create) {
  let sequence = 0;
  const runtime = create(message => postMessage({ ...message, sequence }));
  onmessage = ({ data }) => {
    sequence = data.sequence;
    try {
      if (data.type === 'load') runtime.load(data.artifact, data.environment);
      if (data.type === 'environment') runtime.update(data.environment);
      if (data.type === 'data') runtime.updateData(data.appData);
      if (data.type === 'trigger') runtime.trigger(data.id, data.args);
      postMessage({ type: 'ack', sequence: data.sequence });
    } catch (error) { postMessage({ type: 'error', message: error.message }); }
  };
  postMessage({ type: 'ready' });
}

function frameMain(source, sessionId) {
  addEventListener('message', function connect(event) {
    if (event.source !== parent || event.data?.type !== 'intl-connect' || event.data.sessionId !== sessionId || !event.ports[0]) return;
    removeEventListener('message', connect);
    const port = event.ports[0];
    let url;
    try {
      url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = event => {
        if (event.data?.type === 'ready') URL.revokeObjectURL(url);
        port.postMessage(event.data);
      };
      worker.onerror = event => {
        URL.revokeObjectURL(url); worker.terminate();
        port.postMessage({ type: 'fatal', message: event.message || 'Worker startup failed.' });
      };
      port.onmessage = event => worker.postMessage(event.data);
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      port.postMessage({ type: 'fatal', message: error.message || 'Worker creation failed.' });
    }
  });
  parent.postMessage({ type: 'intl-frame-ready', sessionId }, '*');
}

// The document announces readiness after installing its listener. An iframe load
// event can refer to about:blank or an earlier srcdoc, so it is not a handshake.
export function connectSandboxFrame(iframe, sessionId, connect, hostWindow = window) {
  let connected = false;
  const receive = event => {
    if (connected || event.source !== iframe.contentWindow || event.origin !== 'null' || event.data?.type !== 'intl-frame-ready' || event.data.sessionId !== sessionId) return;
    connected = true;
    hostWindow.removeEventListener('message', receive);
    connect();
  };
  hostWindow.addEventListener('message', receive);
  return () => { connected = true; hostWindow.removeEventListener('message', receive); };
}

export function sandboxDocument(sessionId) {
  const source = `(${workerMain.toString()})(${createRuntime.toString()});`;
  const boot = `(${frameMain.toString()})(${JSON.stringify(source)},${JSON.stringify(sessionId)});`.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'"><script>${boot}</script>`;
}
