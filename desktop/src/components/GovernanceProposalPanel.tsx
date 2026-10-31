import {useEffect,useRef,useState} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {GovernanceEvidenceList,GovernanceRevision} from '../lib/governanceIntelligence';
interface Props {evidence:GovernanceEvidenceList;onRecorded:(revision:GovernanceRevision)=>void}
/** Initial baseline only. Editing/replacing an active baseline needs a separately
 * loaded exact parent; this panel never silently drops an active policy. */
export function GovernanceProposalPanel({evidence,onRecorded}:Props){
 const[selected,setSelected]=useState(''),[action,setAction]=useState<'repository.merge'|'deployment.dispatch'>('repository.merge'),[decision,setDecision]=useState<'block'|'require_approval'>('require_approval'),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState('');
 const owner=useRef({config:desktopClient.config,revision:desktopClient.getContextRevision()}).current,alive=useRef(true),running=useRef(false),active=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const current=()=>alive.current&&owner.config===desktopClient.config&&owner.revision===desktopClient.getContextRevision(),source=evidence.items.find(e=>e.digest===selected&&e.completeness==='complete'&&['github','document'].includes(e.source));
 async function propose(){if(running.current||held||!source||!checked||!current())return;running.current=true;setBusy(true);setMessage('');const controller=new AbortController();active.current=controller;
  try{const scope=source.selection,rule={id:'reviewed-rule-1',actions:[action],scope,decision,requirements:['verified_evidence'],evidenceDigests:[source.digest]},result=await desktopClient.governancePropose({parentDigest:null,scopes:[scope],evidenceDigests:[source.digest],rules:[rule]},crypto.randomUUID(),controller.signal);
   if(!current())return;setHeld(true);setChecked(false);if(result.ok){setMessage('Initial baseline saved for independent review. No policy is active.');onRecorded(result.data)}else setMessage(result.outcomeUnconfirmed?'Proposal outcome is unconfirmed. Load saved baselines before another proposal; no automatic resend.':result.error+' Reload saved records before preparing another proposal.');
  }catch{if(current()){setHeld(true);setChecked(false);setMessage('Proposal outcome is unconfirmed. Load saved baselines before another proposal; no automatic resend.')}}finally{if(current())setBusy(false);running.current=false}
 }
 const disabled=busy||held;
 return <section aria-label="Propose initial baseline" aria-busy={busy} className="rounded-xl border border-white/10 p-4 space-y-3"><header><h2 className="font-medium">Propose an initial baseline</h2><p className="mt-1 text-xs text-zinc-400">Choose saved evidence and one supported rule. The server rechecks current sources. Saving cannot activate or replace a policy.</p></header>
 <label className="block text-xs text-zinc-400">Recorded source<select className="mt-1 block w-full rounded border border-white/15 bg-zinc-950 p-2" value={selected} disabled={disabled} onChange={e=>{setSelected(e.target.value);setChecked(false)}}><option value="">Choose complete GitHub or policy evidence</option>{evidence.items.filter(e=>e.completeness==='complete'&&['github','document'].includes(e.source)).map(e=><option key={e.digest} value={e.digest}>{e.selection.repositoryId} · {e.selection.environment} · {new Date(e.observedAt).toLocaleString()}</option>)}</select></label>
 <label className="block text-xs text-zinc-400">Action<select value={action} disabled={disabled} className="mt-1 block rounded border border-white/15 bg-zinc-950 p-2" onChange={e=>{setAction(e.target.value as typeof action);setChecked(false)}}><option value="repository.merge">Merge a pull request</option><option value="deployment.dispatch">Dispatch a deployment</option></select></label>
 <label className="block text-xs text-zinc-400">Rule<select value={decision} disabled={disabled} className="mt-1 block rounded border border-white/15 bg-zinc-950 p-2" onChange={e=>{setDecision(e.target.value as typeof decision);setChecked(false)}}><option value="require_approval">Require independent approval and verified evidence</option><option value="block">Block this action</option></select></label>
 {source&&<p className="text-xs text-zinc-400">Exact scope: {source.selection.repositoryId} · {source.selection.resourceId} · {source.selection.environment}. Evidence remains historical until a fresh check succeeds.</p>}
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={disabled||!source} onChange={e=>setChecked(e.target.checked)}/>I reviewed this source, scope and proposed rule.</label><button className="btn-primary" disabled={disabled||!source||!checked} onClick={()=>void propose()}>Save initial baseline for review</button>
 {message&&<p role="status" className="text-sm text-zinc-300">{message}</p>}
 </section>;
}
