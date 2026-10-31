import {Readable} from 'node:stream';
import {once} from 'node:events';

/** Adapter for node:http or Express. Mount routing in the host application. */
export function toNodeHandler(handler, {origin = 'http://localhost'} = {}) {
  const base = new URL(origin); if (!['http:', 'https:'].includes(base.protocol)) throw TypeError('Invalid origin');
  return async function nodeHandler(req, res) {
    const stop = new AbortController();
    const close = () => {if (!res.writableEnded) stop.abort();};
    res.on('close', close); req.on('aborted', close);
    let reader;
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      const method = req.method || 'GET';
      const request = new Request(new URL(req.url || '/', base), {method, headers, signal:stop.signal,
        ...(!['GET','HEAD'].includes(method) ? {body:Readable.toWeb(req), duplex:'half'} : {})});
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.flushHeaders();
      reader = response.body?.getReader();
      if (reader) while (true) {
        stop.signal.throwIfAborted(); const {done, value} = await reader.read(); if (done) break;
        if (!res.write(value)) await once(res, 'drain', {signal:stop.signal});
      }
      res.end();
    } catch {
      if (!res.headersSent) {res.writeHead(500, {'Content-Type':'application/json'}); res.end('{"error":{"code":"server_error"}}');}
      else res.destroy();
    } finally {
      stop.abort(); if (reader) {void reader.cancel().catch(() => {}); reader.releaseLock();}
      res.off('close', close); req.off('aborted', close);
    }
  };
}
