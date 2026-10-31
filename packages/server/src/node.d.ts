import type {IncomingMessage, ServerResponse} from 'node:http';
export function toNodeHandler(handler:(request:Request) => Response|Promise<Response>, options?:{origin?:string}):(request:IncomingMessage, response:ServerResponse) => Promise<void>;
