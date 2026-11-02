import {useEffect,useRef,useState} from 'react';
import type {AgentActionRecoveryResult} from '../lib/agentActionExecutionRecovery';
interface Action{id:string;toolName:string}
export function AgentApprovedActions({actions,read}:{actions:Action[];read:(proposalId:string,signal?:AbortSignal)=>Promise<AgentActionRecoveryResult>}){
 return actions.length?<section aria-label="Approved Agent actions" className="space-y-3">{actions.map(action=><ApprovedAction key={action.id} action={action} read={read}/>)}</section>:null;
}
function ApprovedAction({action,read}:{action:Action;read:(proposalId:string,signal?:AbortSignal)=>Promise<AgentActionRecoveryResult>}){
 const [result,setResult]=useState<AgentActionRecoveryResult|null>(null),[busy,setBusy]=useState(false),epoch=useRef(0),pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>{epoch.current++;pending.current?.abort()},[]);
 async function check(){if(pending.current)return;const generation=++epoch.current,abort=new AbortController();pending.current=abort;setBusy(true);try{const next=await read(action.id,abort.signal);if(generation===epoch.current&&!abort.signal.aborted)setResult(next)}catch{if(generation===epoch.current&&!abort.signal.aborted)setResult({ok:false,error:'Saved action outcome could not be verified. No action was repeated.'})}finally{if(generation===epoch.current){pending.current=null;setBusy(false)}}}
 const saved=result?.ok?result.data:null,uncertain=saved?.state==='unknown'||saved?.state==='dispatching';
 const heading=saved?.state==='confirmed'?'Action completed':saved?.state==='refused'?'Action refused before dispatch':saved?.state==='cancelled'?'Saved action cancelled':uncertain?'Outcome unconfirmed':'Approval recorded';
 return <article className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
  <p className="text-xs font-medium text-zinc-200">{heading}</p>
  <p className="mt-1 text-xs text-zinc-400">{(saved?.toolName??action.toolName).replaceAll('_',' ')} · proposal <span className="font-mono">{action.id}</span></p>
  <p className="mt-2 text-xs leading-5 text-zinc-400">{uncertain?'The provider outcome is not confirmed. Do not resend. This read cannot claim or repeat the action.':saved?.state==='confirmed'?'The saved execution record confirms completion. This does not establish deployment health.':saved?.state==='refused'?'The saved attempt is consumed. Review its recorded refusal; this panel cannot repeat it.':saved?.state==='cancelled'?'The unused saved execution was stopped. Its history remains available.':'No new action runs automatically. Check saved action history to verify its outcome. A saved approval alone does not establish execution eligibility.'}</p>
  {result?.ok&&result.data===null&&<p role="status" className="mt-2 text-xs text-zinc-400">No saved execution record was found for this requester. No action was prepared or run.</p>}
  {result&&!result.ok&&<p role="alert" className="mt-2 text-xs text-amber-200">{result.error}</p>}
  {saved&&<p className="mt-2 text-[11px] text-zinc-500">Attempt {saved.attemptCount} · last checked {saved.observedAt}{saved.recoveryState==='lease_elapsed_unconfirmed'?' · worker lease elapsed; outcome still unconfirmed':''}</p>}
  <button type="button" disabled={busy} onClick={()=>void check()} className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50">{busy?'Checking saved outcome…':'Check saved action outcome'}</button>
 </article>;
}
