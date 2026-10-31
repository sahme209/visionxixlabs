import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {GovernanceRevision} from '../lib/governanceIntelligence';
interface Props {baseline:GovernanceRevision;currentUserId:string;canApprove:boolean;canManage:boolean;onRecorded:(revision:GovernanceRevision)=>void}
/** Local exact-review component. Parent must load current workspace records and
 * remount for a changed revision; capabilities here only control presentation.
 * The server independently rechecks authority, source freshness and actors. */
export function GovernanceReviewPanel(props:Props){return <ExactReview key={props.baseline.id+':'+props.baseline.version} {...props}/>}
function ExactReview({baseline,currentUserId,canApprove,canManage,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState(''),running=useRef(false),alive=useRef(true),active=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 const approve=baseline.status==='proposed'&&canApprove&&Boolean(currentUserId)&&baseline.requesterUserId!==currentUserId;
 async function decide(kind:'approve'|'revoke'){
  if(running.current||held||!checked||!owns()||kind==='approve'&&!approve||kind==='revoke'&&(!canManage||baseline.status==='revoked'))return;
  running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  try{const nonce=crypto.randomUUID(),result=kind==='approve'?await desktopClient.governanceApprove(baseline.id,baseline.version,baseline.baseline.digest,nonce,c.signal):await desktopClient.governanceRevoke(baseline.id,baseline.version,nonce,c.signal);
   if(!owns())return;setHeld(true);setChecked(false);
   if(result.ok){setMessage('Baseline decision recorded. This does not activate a policy or execute an action.');onRecorded(result.data)}
   else setMessage(result.outcomeUnconfirmed?'The saved decision is unconfirmed. Read this exact saved baseline before another decision; no automatic resubmission.':result.error+' Read this exact baseline again before another decision.');
  }catch{if(owns()){setHeld(true);setChecked(false);setMessage('The saved decision is unconfirmed. Read this exact saved baseline before another decision; no automatic resubmission.')}}
  finally{if(owns())setBusy(false);running.current=false}
 }
 if(revision!==owner.revision||desktopClient.config!==owner.config)return <p role="status">Workspace changed. Load the baseline again before reviewing.</p>;
 return <section aria-label="Exact baseline decision" aria-busy={busy} className="rounded-xl border border-white/10 p-4 space-y-3">
 <header><h2 className="font-medium">Review this baseline</h2><p className="mt-1 text-xs text-zinc-400">Approval records an independent decision about these exact rules. Enforcement remains unavailable until all action paths are covered.</p></header>
 <p className="text-sm">{baseline.status} · version {baseline.version}</p><p className="text-xs text-zinc-400">Requested by {baseline.requesterUserId}</p>
 <ul className="text-xs text-zinc-400">{baseline.baseline.scopes.map(s=><li key={JSON.stringify(s)}>{s.repositoryId} · {s.resourceId} · {s.environment}</li>)}</ul>
 <ul className="space-y-2 text-sm">{baseline.baseline.rules.map(r=><li key={r.id}><p>{r.id}: {r.decision}</p><p className="text-xs text-zinc-400">{r.actions.join(', ')} · {r.requirements.join(', ')||'No additional declared requirements'}</p><p className="text-xs text-zinc-400">{r.scope.repositoryId} · {r.scope.resourceId} · {r.scope.environment}</p></li>)}</ul>
 <details className="text-xs text-zinc-400"><summary>Exact review and evidence identifiers</summary><p className="break-all">{baseline.id}</p><p className="break-all">Digest {baseline.baseline.digest}</p>{baseline.baseline.evidenceDigests.map(d=><p key={d} className="break-all">Evidence {d}</p>)}</details>
 {baseline.status!=='revoked'&&<><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy||held||!approve&&!canManage} onChange={e=>setChecked(e.target.checked)}/>I reviewed these exact scopes, rules and evidence bindings.</label>
 {baseline.status==='proposed'&&<button className="btn-primary" disabled={!approve||!checked||busy||held} onClick={()=>void decide('approve')}>Record independent baseline approval</button>}
 {canManage&&<button className="btn-secondary ml-2" disabled={!checked||busy||held} onClick={()=>void decide('revoke')}>Revoke this baseline revision</button>}
 {baseline.requesterUserId===currentUserId&&baseline.status==='proposed'&&<p className="text-xs text-zinc-400">Another authorized person must review your proposal.</p>}</>}
 {message&&<p role="status" className="text-sm text-zinc-300">{message}</p>}
 </section>;
}
