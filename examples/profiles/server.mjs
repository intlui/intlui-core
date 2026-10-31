import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {createServer as createViteServer} from 'vite';
import {toNodeHandler} from '@intlui/server/node';
import {createDemoChat} from './chat-server.mjs';

const port = Number(process.env.PORT || 5194), origin = `http://127.0.0.1:${port}`;
const chat = toNodeHandler(createDemoChat(), {origin});
const vite = await createViteServer({root:fileURLToPath(new URL('.', import.meta.url)), configFile:false,
  server:{middlewareMode:true,hmr:false}, appType:'spa'});
const server = createServer((req, res) => {
  if (req.url === '/api/chat') {void chat(req, res); return;}
  vite.middlewares(req, res);
});
server.listen(port, '127.0.0.1', () => console.log(`Synthetic profile demo: ${origin}`));
async function shutdown() {server.closeAllConnections(); server.close(); await vite.close();}
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
