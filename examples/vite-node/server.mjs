import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {createServer as createViteServer} from 'vite';
import {toNodeHandler} from '@intlui/server/node';
import {createExampleChat} from './chat-server.mjs';

if (process.argv.includes('--demo')) process.env.INTLUI_DEMO = '1';
const port = Number(process.env.PORT || 5178), origin = `http://127.0.0.1:${port}`;
const chat = toNodeHandler(createExampleChat(), {origin});
const vite = await createViteServer({root:fileURLToPath(new URL('.',import.meta.url)), configFile:false,
  server:{middlewareMode:true,hmr:false}, appType:'spa'});
const server = createServer((req,res) => {
  if (req.url === '/api/chat') {void chat(req,res); return;}
  if (req.url === '/api/config') {res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify({demo:process.env.INTLUI_DEMO === '1'})); return;}
  vite.middlewares(req,res);
});
server.listen(port,'127.0.0.1',() => console.log(`IntlUI ${process.env.INTLUI_DEMO === '1' ? 'synthetic demo' : 'OpenAI'}: ${origin}`));
async function shutdown() {server.closeAllConnections(); server.close(); await vite.close();}
process.once('SIGINT',shutdown); process.once('SIGTERM',shutdown);
