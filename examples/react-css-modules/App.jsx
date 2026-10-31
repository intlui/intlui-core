import React, {useEffect, useRef, useState} from 'react';
import {IntluiAnswer, IntluiProvider} from '@intlui/react';
import '@intlui/react/styles.css';
import {adapters} from './adapters.jsx';
import {createFixture} from './fixture.js';
import styles from './host.module.css';

export function AdapterDemo() {
  const [theme, setTheme] = useState('light'), [custom, setCustom] = useState(true), [run, setRun] = useState(0);
  const [state, setState] = useState(null);
  const counter = useRef(0);
  useEffect(() => {
    const fixture = createFixture(`turn-${++counter.current}`);
    setState(fixture.next());
    const timer = setInterval(() => {const next = fixture.next(); setState(next); if (next.terminal) clearInterval(timer);}, 2000);
    return () => clearInterval(timer);
  }, [run]);
  return <main className={styles.page} data-theme={theme}>
    <h1>IntlUI with CSS Modules</h1>
    <p>Synthetic demo without model calls. Edit the controls while six updates arrive.</p>
    <div className={styles.toolbar}>
      <button onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>Change theme</button>
      <button aria-pressed={custom} onClick={() => setCustom(value => !value)}>Host components: {custom ? 'enabled' : 'disabled'}</button>
      <button onClick={() => setRun(value => value + 1)}>New response (reset controls)</button>
    </div>
    <p>Data changes within the same block. A new response has a new identity and starts with initial values.</p>
    <IntluiProvider theme={theme} components={custom ? adapters : {}}>
      <IntluiAnswer state={state}/>
    </IntluiProvider>
  </main>;
}
