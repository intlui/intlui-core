import Chat from './Chat.jsx';
export const dynamic = 'force-dynamic';
export default function Page() {return <Chat demo={process.env.INTLUI_DEMO === '1'}/>;}
