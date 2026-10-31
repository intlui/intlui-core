import React, { useEffect, useRef, useState } from 'react';
import { sandboxDocument, connectSandboxFrame } from './sandbox.js';
import { createSandboxSession } from './sandbox-session.js';
import { Tree, AdapterContext } from './components.jsx';
import { useAppearance } from './IntluiProvider.jsx';
import { rendererMessages } from './messages.js';
import { HostContext } from './visual-components.jsx';

export function DilRenderer({ artifact, appData, host: localHost, theme: localTheme, locale: localLocale, components: localComponents, classNames: localClassNames, timeoutMs = 4000, startupTimeoutMs = 12000, onError, onRendered }) {
  const { theme, locale, components, classNames, host } = useAppearance({ host: localHost, locale: localLocale, theme: localTheme, components: localComponents, classNames: localClassNames });
  const t = rendererMessages(locale);
  const frame = useRef(null), send = useRef(() => {});
  const environment = useRef({ theme });
  environment.current = { theme };
  const latestData = useRef(appData); latestData.current = appData;
  const [view, setView] = useState({ tree: null, error: null, diagnostics: [], loading: true });
  const renderedCallback = useRef(onRendered); renderedCallback.current = onRendered;
  useEffect(() => {
    if (!view.tree || !renderedCallback.current) return;
    let second;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => renderedCallback.current?.()); });
    return () => { cancelAnimationFrame(first); if (second) cancelAnimationFrame(second); };
  }, [view.tree]);
  useEffect(() => { if (view.error) onError?.(view.error); }, [view.error, onError]);
  useEffect(() => {
    setView({ tree: null, error: null, diagnostics: [], loading: true });
    // Each effect owns its document, including React StrictMode setup/cleanup.
    const iframe = document.createElement('iframe');
    iframe.title = 'Runtime isolato';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.hidden = true;
    const sessionId = crypto.randomUUID();
    const channel = new MessageChannel();
    let disconnect = () => {};
    const session = createSandboxSession({
      port: channel.port1, timeoutMs, startupTimeoutMs, onView: setView,
      getInitialLoad: () => ({
        artifact: latestData.current === undefined ? artifact : { ...artifact, appData: latestData.current },
        environment: environment.current,
      }),
      onClose: () => { disconnect(); channel.port2.close(); iframe.remove(); },
    });
    disconnect = connectSandboxFrame(iframe, sessionId, () => {
      try { iframe.contentWindow.postMessage({ type: 'intl-connect', sessionId }, '*', [channel.port2]); }
      catch (error) { session.fail(`Sandbox connection failed: ${error.message}`); }
    });
    send.current = session.post;
    iframe.srcdoc = sandboxDocument(sessionId);
    frame.current.appendChild(iframe);
    return () => {
      session.dispose();
      send.current = () => {};
    };
  }, [artifact, timeoutMs, startupTimeoutMs]);
  useEffect(() => send.current({ type: 'environment', environment: { theme } }), [theme]);
  useEffect(() => { if (appData !== undefined) send.current({ type: 'data', appData }); }, [appData]);
  return <section className="intl-ui" data-theme={theme} lang={locale} aria-label={t.generated}>
    <div ref={frame} hidden />
    {view.loading && <p role="status">{t.loading}</p>}
    {view.error && <p role="alert" className="intl-error">{view.error}</p>}
    {view.diagnostics.map(message => <p className="intl-warning" key={message}>{message}</p>)}
    <HostContext.Provider value={host || {}}><AdapterContext.Provider value={{ components, classNames, locale, sequence: view.sequence ?? 0 }}>{view.tree ? <Tree node={view.tree} dispatch={(id, ...args) => send.current({ type: 'trigger', id, args })} /> : !view.loading && <pre className="intl-fallback">{artifact.fallbackMarkdown || t.unavailable}</pre>}</AdapterContext.Provider></HostContext.Provider>
  </section>;
}
