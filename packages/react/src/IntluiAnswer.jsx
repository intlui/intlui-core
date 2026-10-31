import React, { Component, memo, useCallback, useMemo, useRef } from 'react';
import { validateBlock, UI_PROFILE, profileKey, supportsBlock } from '@intlui/protocol';
import {defaultRendererProfiles} from './profiles.jsx';
import { blockIdentity } from './identity.js';
import { useAppearance } from './IntluiProvider.jsx';
import { rendererMessages, answerStatusLabel, answerErrorLabel } from './messages.js';

class RenderBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">{this.props.message}</p> : this.props.children;
  }
}

// Compile source only; data updates are delivered separately to the existing
// runtime. Passing appData to compilation would recreate the payload and state.
export function DilSource({ source, appData, profile = UI_PROFILE, ...props }) {
  const appearance = useAppearance(props), {locale} = appearance;
  const profiles=appearance.profiles ?? defaultRendererProfiles;
  let selected;
  try {selected=profileKey(profile);} catch {selected=null;}
  const t = rendererMessages(locale);
  const compiled = useMemo(() => {
    try { return profiles.compile(profile, source); }
    catch (error) { return { error: error.message }; }
  }, [source, selected, profiles]);
  if (compiled.error) return <p role="alert">{t.compileFailed}: {compiled.error}</p>;
  try {
    const result=compiled.adapter.validateData(compiled.artifact.value, appData ?? {});
    if(result === false || result?.then)throw TypeError('Invalid profile data');
  } catch(error) {return <p role="alert">{t.invalidBlock}: {error.message}</p>;}
  const Renderer=compiled.Renderer;
  return <>
    {compiled.diagnostics.filter(item => item.severity !== 'info').map((item, i) => <p role="status" key={i}>{item.message}</p>)}
    <Renderer key={selected} artifact={compiled.artifact} appData={appData} {...props} {...appearance} />
  </>;
}

const Block = memo(function Block({ block, capabilities, onRendered, ...props }) {
  const { locale } = useAppearance(props);
  const t = rendererMessages(locale);
  const originalSource = useRef(block.source);
  const originalProfile = useRef(profileKey(block.profile ?? UI_PROFILE));
  const reportRendered = useCallback(() => onRendered?.({blockId: block.id, revision: block.revision}), [onRendered, block.id, block.revision]);
  try { validateBlock(block); if(capabilities && !supportsBlock(capabilities,block))throw TypeError('Block profile or capabilities mismatch'); }
  catch (error) { return <p role="alert">{t.invalidBlock}: {error.message}</p>; }
  if (originalSource.current !== block.source || originalProfile.current !== profileKey(block.profile ?? UI_PROFILE)) return <p role="alert">{t.replacedSource}</p>;
  return <DilSource source={block.source} appData={block.appData} profile={block.profile ?? UI_PROFILE} {...props} onRendered={onRendered ? reportRendered : undefined} />;
});

export function IntluiAnswer({ state, theme, components, classNames, host, profiles, locale: localLocale, onRendered, interruption }) {
  const { locale } = useAppearance({ locale: localLocale });
  const t = rendererMessages(locale);
  if (!state) return null;
  const interrupted = !state.terminal && ['cancelled', 'disconnected'].includes(interruption) ? interruption : undefined;
  return <section data-interruption={interrupted} className="intlui-answer" data-turn-status={state.status} lang={locale} aria-label={t.answer}>
    <article aria-label={t.original}><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{state.text}</div></article>
    <div aria-label={t.blocks}>{state.blocks.map(block => <article key={blockIdentity(state, block.id)} data-intlui-block={block.id} data-block-revision={block.revision}>
      <RenderBoundary message={t.viewFailed}><Block locale={locale} block={block} capabilities={state.capabilities} theme={theme} components={components} classNames={classNames} host={host} profiles={profiles} onRendered={onRendered} /></RenderBoundary>
    </article>)}</div>
    <p role="status">{interrupted === 'cancelled' ? t.interrupted : interrupted === 'disconnected' ? t.disconnected : answerStatusLabel(state, locale)}</p>
    {state.errors.map((error, i) => <p role="alert" key={i}>{answerErrorLabel(error, locale)}</p>)}
  </section>;
}
