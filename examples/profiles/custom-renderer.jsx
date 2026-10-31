import React, {useMemo, useState} from 'react';
import {createRendererProfiles} from '@intlui/react';
import {Tree} from '@intlui/react/primitives';
import {profile, components, compile, validateData, createCounterState} from './custom-counter.js';

export function CounterRenderer({artifact, appData}) {
  // A source replacement resets local clicks; data revisions keep the artifact.
  const runtime = useMemo(() => createCounterState(), [artifact]);
  const [, update] = useState(0);
  return <Tree node={runtime.tree(artifact.value, appData)} dispatch={() => {
    runtime.increment(); update(value => value + 1);
  }}/>;
}
export const profiles = createRendererProfiles([{profile, components, compile, validateData, Renderer:CounterRenderer}]);
