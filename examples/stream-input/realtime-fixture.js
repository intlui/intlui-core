// Authored event replay, not captured audio or a live provider connection.
export const realtimeOptions = {responseId: 'response-demo', itemId: 'item-demo'};
const scope = {response_id: realtimeOptions.responseId, item_id: realtimeOptions.itemId, output_index: 0, content_index: 0};
export const realtimeEvents = [
  {...scope, type: 'response.output_audio_transcript.delta', event_id: 'first', delta: 'Four items are available. '},
  {...scope, type: 'response.output_audio.delta', event_id: 'audio', delta: 'ignored-audio-fixture'},
  {...scope, type: 'response.output_audio_transcript.delta', event_id: 'second', delta: 'Delivery is expected tomorrow.'},
  {...scope, type: 'response.output_audio_transcript.done', event_id: 'transcript', transcript: 'Four items are available. Delivery is expected tomorrow.'},
  {type: 'response.done', event_id: 'complete', response: {id: realtimeOptions.responseId, status: 'completed', output: [
    {id: realtimeOptions.itemId, type: 'message', role: 'assistant', content: [{type: 'output_audio', transcript: 'Four items are available. Delivery is expected tomorrow.'}]}
  ]}},
];
