import {DilSource, DilRenderer, useIntluiChat, createRendererProfiles} from '@intlui/react';
import {compileDil} from '@intlui/react/compiler';
import type {LanguageProfile, JsonObject} from '@intlui/protocol';
import type * as Client from '@intlui/client';
import type * as Server from '@intlui/server';

export type PublicModules = [typeof Client, typeof Server];
const profile: LanguageProfile = {id:'intlui.ui', version:'0.1'};
const data: JsonObject = {title:'Synthetic example'};
const compiled = compileDil('<text>Example</text>', {appData:data});
createRendererProfiles().resolve(profile);

export function Example() {
  const chat = useIntluiChat({endpoint:'/api/chat'});
  return <section>
    <DilSource source="<text>Example</text>" appData={data}/>
    <DilRenderer artifact={compiled.payload}/>
    <button onClick={() => chat.stop()}>Stop</button>
  </section>;
}

// Incorrect public inputs must remain compile errors.
// @ts-expect-error DIL sources must be strings.
compileDil(123);
// @ts-expect-error Source is required.
const invalid = <DilSource/>;
void invalid;
