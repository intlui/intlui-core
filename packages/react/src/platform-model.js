export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function fileLimit(value) {
  return Number.isFinite(value) ? Math.max(1, Math.min(MAX_FILE_BYTES, value)) : MAX_FILE_BYTES;
}

export function downloadBytes(content, encoding = 'utf8') {
  if (typeof content !== 'string') throw new Error('Content must be a string.');
  if (content.length > MAX_FILE_BYTES * 2) throw new Error('File is too large.');
  const bytes = encoding === 'base64' ? Uint8Array.from(atob(content), c => c.charCodeAt(0)) : new TextEncoder().encode(content);
  if (bytes.length > MAX_FILE_BYTES) throw new Error('File is too large.');
  return bytes;
}

export function downloadName(value) {
  const name = String(value || 'download.txt').replace(/[\\/\x00-\x1f<>:"|?*]/g, '_').slice(0, 120);
  return name === '.' || name === '..' ? 'download.txt' : name;
}

export function timerInterval(value) {
  return Math.max(50, Math.min(60000, Number(value) || 1000));
}
