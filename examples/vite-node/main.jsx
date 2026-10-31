import React from 'react';
import {createRoot} from 'react-dom/client';
import Chat from './Chat.jsx';
import '@intlui/react/styles.css';
import './style.css';
fetch('/api/config').then(response => response.json()).then(config => {
  createRoot(document.getElementById('root')).render(<React.StrictMode><Chat demo={config.demo}/></React.StrictMode>);
}).catch(() => {document.getElementById('root').textContent = 'Server configuration unavailable.';});
