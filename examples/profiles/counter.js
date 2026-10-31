// Synthetic grammar, independent of the built-in UI language.
export const profile = Object.freeze({id:'example.counter', version:'0.1'});
export const components = ['button', 'text'];
export function compile(source) {
  const artifact = JSON.parse(source);
  if (!artifact || Array.isArray(artifact) || Object.keys(artifact).sort().join(',') !== 'kind,label' ||
      artifact.kind !== 'counter' || typeof artifact.label !== 'string' || artifact.label.length > 120) throw TypeError('Invalid counter document');
  return {artifact, requiredComponents:components};
}
export function validateData(artifact, data) {
  if (!data || Object.keys(data).join(',') !== 'count' || !Number.isSafeInteger(data.count) || data.count < 0) throw TypeError('Invalid counter data');
}
export const serverProfile = {profile, compile, validateData,
  instructions:'Use source JSON {"kind":"counter","label":"short label"}, never UI markup. appData must be {"count": nonnegative integer}. Required components: button, text. Use data operations to update the count.'};

// One owner for local interaction state; a data revision does not reset it.
export function createCounterState() {
  let clicks = 0;
  return {increment() {clicks++;}, tree(artifact, data) {
    validateData(artifact, data);
    return [
      {type:'text', props:{}, children:[`${artifact.label}: ${data.count}; local clicks: ${clicks}`]},
      {type:'button', props:{onClick:{$callback:1}}, children:['Increment local counter']}
    ];
  }};
}
