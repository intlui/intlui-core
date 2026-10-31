const messages = {
  en: {
    statuses: {receiving: 'Receiving response...', translating: 'Preparing interface...', complete: 'Response complete.', partial: 'Partial response. Content may be incomplete.', cancelled: 'Response cancelled.', failed: 'Response failed.'},
    unknownStatus: 'Response status unavailable.',
    partialInterface: 'Partial interface. Refer to the original text received.',
    translationErrors: {
      translation_limit: 'Translation limit reached. Controls may not represent all received text.',
      translation_failed: 'Some interface updates are unavailable. Refer to the original text received.',
    },
    chart: 'Chart', chartData: 'Chart data', category: 'Category', missingData: 'Data unavailable',
    emptyChart: 'No data to display.', unsupportedChart: 'Chart not supported by the prototype.',
    value: 'Value', text: 'Text', selection: 'Selection', options: 'Options',
    unsupported: 'Unsupported component', math: 'LaTeX formula (math rendering not implemented)',
    answer: 'Progressive answer', original: 'Original text', blocks: 'Interactive blocks',
    generated: 'Generated interface', loading: 'Loading interface...', unavailable: 'Preview unavailable.',
    viewFailed: 'View unavailable. The original text remains available.',
    compileFailed: 'Compilation error', invalidBlock: 'Invalid block',
    replacedSource: 'The source of an existing block cannot be replaced without an explicit reset.',
    interrupted: 'Response interrupted. Received content remains available.',
    disconnected: 'Connection interrupted. The response may be incomplete.',
  },
};

export function rendererMessages(locale) {return Object.hasOwn(messages, locale) ? messages[locale] : messages.en;}

// Only known translation errors qualify. Unknown errors and interrupted sources
// must not be presented as a translation-only problem.
export function answerStatusLabel(state, locale = 'en') {
  const t = rendererMessages(locale);
  if (state.terminal && state.status === 'partial' && state.errors.length &&
    state.errors.every(error => Object.hasOwn(t.translationErrors, error.code))) return t.partialInterface;
  return turnStatusLabel(state.status, locale);
}

export function answerErrorLabel(error, locale = 'en') {
  const labels = rendererMessages(locale).translationErrors;
  return Object.hasOwn(labels, error.code) ? labels[error.code] : error.message;
}

/** Presentation only; never changes protocol state or classifies an unknown state as successful. */
export function turnStatusLabel(status, locale = 'en') {
  const t = rendererMessages(locale);
  return Object.hasOwn(t.statuses, status) ? t.statuses[status] : t.unknownStatus;
}
