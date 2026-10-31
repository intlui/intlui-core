import test from 'node:test';
import assert from 'node:assert/strict';
import {httpError, IntluiHttpError} from '../src/http-error.js';

test('HTTP failures expose status and known code but never arbitrary server text', async () => {
  const error = await httpError(Response.json({error: {code: 'turn_quota', message: 'secret-provider-body'}}, {status: 429}));
  assert(error instanceof IntluiHttpError); assert.equal(error.code, 'turn_quota'); assert.equal(error.status, 429);
  assert(!JSON.stringify(error).includes('secret')); assert(!error.message.includes('secret'));
  for (const body of ['<html>secret</html>', JSON.stringify({error: {code: 'secret'}}), 'x'.repeat(8193)]) {
    assert.equal((await httpError(new Response(body, {status: 503}))).code, 'http_error');
  }
});

test('reading an error body releases a stalled reader on cancellation', {timeout: 2000}, async () => {
  const controller = new AbortController(); let cancelled = false;
  const body = new ReadableStream({cancel() {cancelled = true; return new Promise(() => {});}});
  const result = httpError(new Response(body, {status: 429}), controller.signal);
  controller.abort(); await assert.rejects(result, {name: 'AbortError'});
  assert(cancelled); assert.equal(body.locked, false);
});

test('expired replay retains its safe code and does not suggest an automatic retry', async () => {
  const error = await httpError(Response.json({error: {code: 'replay_expired', message: 'secret'}}, {status: 410}));
  assert.equal(error.code, 'replay_expired'); assert.equal(error.status, 410);
  assert.match(error.message, /will not be retried/); assert.ok(!error.message.includes('secret'));
});
