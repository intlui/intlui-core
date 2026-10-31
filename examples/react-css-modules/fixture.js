import {createTurnState, reduceEvent} from '@intlui/protocol';
export const source = `{@body const data=DIL.useAppData()}
{@body const [checked,setChecked]=DIL.useState(false)}
{@body const [name,setName]=DIL.useState('')}
{@body const [budget,setBudget]=DIL.useState(50)}
{@body const [plan,setPlan]=DIL.useState('basic')}
<title>{data.title}</title>
<checkbox checked={checked} onChange={setChecked}>Include support</checkbox>
<input aria-label="Project name" value={name} onChange={setName} placeholder="Your project"/>
<slider aria-label="Budget" min={0} max={100} step={5} value={budget} onChange={setBudget}/>
<select aria-label="Plan" value={plan} onChange={setPlan} options={[{value:'basic',label:'Base'},{value:'pro',label:'Pro'},{value:'soon',label:'Coming soon',disabled:true}]}/>
<text>{data.note}</text>
<code>{JSON.stringify({checked,name,budget,plan})}</code>`;
export function createFixture(turnId) {
  const scope = {projectId: 'adapter-demo', conversationId: 'local', turnId};
  let sequence = 0, revision = 0;
  let state = createTurnState(scope, {surface: 'react', formats: ['dil'], components: ['title','checkbox','input','slider','select','text','code']});
  const apply = payload => state = reduceEvent(state, {version: '0.1', ...scope, turnRevision: 0, sequence: ++sequence, ...payload});
  return {
    next() {
      if (state.terminal) return state;
      revision++;
      const appData = {title: 'Host configurator', note: `Update ${revision} of 6`};
      apply({type: 'text.delta', text: `Update ${revision}: new data available.\n`});
      if (revision === 1) apply({type: 'ui.create', block: {id: 'configurator', format: 'dil', revision, source, appData, requiredComponents: ['title','checkbox','input','slider','select','text','code']}});
      else apply({type: 'ui.data', id: 'configurator', revision, appData});
      if (revision === 6) apply({type: 'turn.end', status: 'complete'});
      return state;
    }
  };
}
