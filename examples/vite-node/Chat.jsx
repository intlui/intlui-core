'use client';
import React, {useEffect, useState} from 'react';
import {IntluiAnswer, useIntluiChat} from '@intlui/react';

export default function Chat({demo = false}) {
  const [token, setToken] = useState(''), [draft, setDraft] = useState('Prepare a checklist for publishing a React website.');
  useEffect(() => {if (demo) setToken(crypto.randomUUID());}, [demo]);
  const chat = useIntluiChat({endpoint:'/api/chat', token:token || undefined});
  async function submit(event) {
    event.preventDefault();
    try {await chat.send(draft); setDraft('');} catch { /* The hook preserves content and exposes the error. */ }
  }
  return <main>
    <header><span className="label">INTLUI · {demo ? 'LOCAL DEMO' : 'OPENAI'}</span><h1>Chat with interactive responses.</h1>
      <p>{demo ? 'Explicit synthetic responses. No AI calls.' : 'OpenAI responses with DIL interfaces, from your server.'}</p></header>
    {!demo && <label>Application session token<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="Do not enter your OpenAI key"/></label>}
    <button type="button" onClick={chat.reset}>New conversation</button>
    <section aria-label="Conversation">{chat.items.map(item => <article key={item.id}>
      <p className="question">{item.prompt}</p>
      {item.state ? <IntluiAnswer state={item.state} interruption={item.interruption}/> : <p role="status">{item.interruption ? 'Request interrupted.' : 'Waiting for a response…'}</p>}
    </article>)}</section>
    {chat.error && <p role="alert">{chat.error.message}</p>}
    {chat.contextLost && <p role="alert">Context expired. Start a new conversation.</p>}
    <form onSubmit={submit}>
      <label>Message<textarea value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={4096}/></label>
      {chat.busy ? <button type="button" onClick={chat.stop}>Stop</button> : <button disabled={!token || !draft.trim() || chat.contextLost}>Send</button>}
    </form>
  </main>;
}
