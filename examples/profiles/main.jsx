import React from 'react';
import {createRoot} from 'react-dom/client';
import {IntluiAnswer, useIntluiChat} from '@intlui/react';
import {profile} from './custom-counter.js';
import {profiles} from './custom-renderer.jsx';
import '@intlui/react/styles.css';
import '../vite-node/style.css';

const capabilities = profiles.capabilities(profile,{surface:'example.dashboard'});
function Demo() {
  const chat = useIntluiChat({endpoint:'/api/chat', protocolVersion:'0.2', capabilities});
  return <main><h1>An external surface and component</h1>
    <p>Synthetic local demo. No AI calls. Click the counter while server data updates: local clicks stay.</p>
    <button disabled={chat.busy} onClick={() => {void chat.send('Show the counter').catch(() => {});}}>Start</button>
    <button onClick={chat.reset}>Reset conversation</button>
    {chat.items.map(item => <IntluiAnswer key={item.id} state={item.state} profiles={profiles} locale="en" interruption={item.interruption}/>)}
    {chat.error && <p role="alert">{chat.error.message}</p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Demo/>);
