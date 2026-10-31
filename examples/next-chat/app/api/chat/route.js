import {createExampleChat} from '../../../chat-server.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let handler;
export async function POST(request) {
  handler ??= createExampleChat();
  return handler(request);
}
