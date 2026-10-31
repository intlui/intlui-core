import React, {useEffect, useMemo, useReducer} from 'react';
import {createRendererProfiles} from '@intlui/react';
import {Tree, AdapterContext, HostContext} from '@intlui/react/primitives';
import {profile, components, compile, validateData, createCounterState} from './counter.js';

export function CounterRenderer({artifact, appData, components, classNames, host, onRendered}) {
  const state = useMemo(() => createCounterState(), [artifact]);
  const [revision, refresh] = useReducer(value => value + 1, 0);
  useEffect(() => {onRendered?.();}, [artifact, appData, revision, onRendered]);
  return <HostContext.Provider value={host ?? {}}><AdapterContext.Provider value={{components, classNames}}>
    <Tree node={state.tree(artifact.value, appData)} dispatch={id => {if (id === 1) {state.increment(); refresh();}}}/>
  </AdapterContext.Provider></HostContext.Provider>;
}
export const profiles = createRendererProfiles([{profile, components, compile, validateData, Renderer:CounterRenderer}]);
