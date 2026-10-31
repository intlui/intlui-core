import React from 'react';
import {createRoot} from 'react-dom/client';
import {IntluiAnswer, useIntluiChat} from '@intlui/react';
import {profile} from './counter.js';
import {profiles} from './renderer.jsx';
import '@intlui/react/styles.css';
import '../vite-node/style.css';

const capabilities = profiles.capabilities(profile);
function Demo() {
  const chat = useIntluiChat({endpoint:'/api/chat', capabilities});
  return <main><h1>A different language, shared controls</h1>
    <p>Synthetic local demo. No AI calls. Click the counter while server data updates: local clicks stay.</p>
    <button disabled={chat.busy} onClick={() => {void chat.send('Show the counter').catch(() => {});}}>Start</button>
    <button onClick={chat.reset}>Reset conversation</button>
    {chat.items.map(item => <IntluiAnswer key={item.id} state={item.state} profiles={profiles} locale="en" interruption={item.interruption}/>)}
    {chat.error && <p role="alert">{chat.error.message}</p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Demo/>);
