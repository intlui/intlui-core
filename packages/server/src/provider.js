import { responseText } from './stream-transport.js';
import { createStreamTranslator } from './stream-translator.js';

// Only server configuration can select models or supply credentials.
export function createOpenAiProvider({ apiKey, model, translationModel = model, fetchImpl = fetch, timeoutMs = 60000, maxOutputTokens = 8192,
  instructions = 'Answer the user in ordinary text. Do not generate DIL or claim to perform external actions. Preserve qualifications and distinguish illustrative data.' } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw Error('OPENAI_API_KEY is required.');
  if (![model, translationModel].every(value => typeof value === 'string' && value.trim() && value.length <= 200)) throw Error('Explicit model configuration is required.');
  if (![timeoutMs, maxOutputTokens].every(value => Number.isSafeInteger(value) && value > 0)) throw Error('Invalid provider limits.');
  const settings = { apiKey, model, fetchImpl, timeoutMs, maxOutputTokens };
  if (typeof instructions !== 'string' || instructions.length > 30000) throw TypeError('Invalid instructions');
  return {
    id: 'openai', modes: ['translate', 'generate'],
    translate: createStreamTranslator({ ...settings, model: translationModel }),
    async *generate({ text, history = [], signal, onUsage = () => {} }) {
      const combined = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
      yield* responseText({ ...settings, signal: combined,
        instructions,
        input: [...history, { role: 'user', content: text }],
        onEvent: event => { if (event.stage === 'completed') onUsage(event.usage); }
      });
    }
  };
}
