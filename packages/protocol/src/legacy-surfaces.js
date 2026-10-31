// Frozen compatibility rules for published wire protocol 0.1 only.
export function validateLegacySurface(value) {
  if (!['react', 'widget', 'shopify-account', 'text'].includes(value.surface)) throw new TypeError('Unsupported surface in protocol 0.1');
  if (['shopify-account', 'text'].includes(value.surface) && (value.formats.length || value.components.length)) throw new TypeError('Surface is text-only in protocol 0.1');
}
