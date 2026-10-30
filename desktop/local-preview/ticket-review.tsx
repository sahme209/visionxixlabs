import React from 'react';
import {createRoot} from 'react-dom/client';
import {TicketGovernancePanel} from '../src/components/TicketGovernancePanel';
import '../src/styles.css';
function Preview(){const [provider,setProvider]=React.useState<'jira'|'servicenow'>('jira');return <main className="mx-auto max-w-3xl space-y-5 p-8"><h1 className="text-2xl font-semibold">Axiom · Ticket deployment review</h1><p className="rounded-lg border border-amber-500/30 p-3 text-sm text-amber-200">Local preview · No paired session or provider connection. Nothing here can approve, link or close a real ticket.</p><div className="flex gap-3">{(['jira','servicenow'] as const).map(p=><button className="btn-secondary" key={p} onClick={()=>setProvider(p)}>{p==='jira'?'Jira':'ServiceNow'}</button>)}</div><TicketGovernancePanel key={provider} version={1} provider={provider}/></main>}
createRoot(document.getElementById('root')!).render(<Preview/>);
