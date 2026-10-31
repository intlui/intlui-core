import React from 'react';
import {createRoot} from 'react-dom/client';
import {StreamingConsumer, streamingMetrics} from './streaming-consumer.jsx';
import '@intlui/react/styles.css';

createRoot(document.getElementById('root')).render(<StreamingConsumer/>);
const timer = setInterval(() => {
  document.getElementById('diagnostic').textContent = `Checkbox renders: ${streamingMetrics.checkboxRenders} · Completed UI updates: ${streamingMetrics.completedRenders} · Revision: ${streamingMetrics.revision}. Adding only text should not increase these counters.`;
}, 250);
window.addEventListener('pagehide', () => clearInterval(timer), {once: true});
