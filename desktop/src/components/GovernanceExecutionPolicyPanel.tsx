import {useExecutionPolicyRecovery} from '../lib/useExecutionPolicyRecovery';
import type {ExecutionPolicyRecoveryRecord} from '../lib/executionPolicyRecoveryStore';
import {GovernanceExecutionPolicyProposal} from './GovernanceExecutionPolicyProposal';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {executionPolicyId,type ExecutionPolicyRevision,type ExecutionPolicyMutation,type ExecutionPolicyPointer,type ExecutionPolicyDirectory,type ExecutionPolicyRequests} from '../lib/governanceExecutionPolicy';
interface Props {organizationId:string;currentUserId:string;canManage:boolean;canApprove:boolean;scopes:Array<{repositoryId:string;resourceId:string;environment:'production'|'staging'|'development'|'qa'}>}
/** Local prototype. Capabilities affect presentation only; paired server services
 * independently enforce current authority, exact scope and human independence. */
export function GovernanceExecutionPolicyPanel(props:Props){const rev=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);return <PolicySession key={rev+':'+props.organizationId+':'+props.currentUserId+':'+JSON.stringify(props.scopes.map(scope=>[scope.repositoryId,scope.resourceId,scope.environment]))} {...props}/>}
function PolicySession({organizationId,currentUserId,canManage,canApprove,scopes}:Props){
 const recovery=useExecutionPolicyRecovery(organizationId,currentUserId);
 const owner=useRef({config:desktopClient.config,revision:desktopClient.getContextRevision()}).current,alive=useRef(true),running=useRef(false),active=useRef<AbortController|undefined>(undefined);
 const[directory,setDirectory]=useState<ExecutionPolicyDirectory>(),[requests,setRequests]=useState<ExecutionPolicyRequests>();
 const[id,setId]=useState(''),[policy,setPolicy]=useState<ExecutionPolicyRevision>(),[pointer,setPointer]=useState<ExecutionPolicyPointer>(),[checked,setChecked]=useState(false),[held,setHeld]=useState(false),[pending,setPending]=useState<ExecutionPolicyMutation>(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[clock,setClock]=useState(Date.now());
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setClock(Date.now()),15000);return()=>{alive.current=false;clearInterval(timer);active.current?.abort()}},[]);
 const owns=()=>alive.current&&owner.config===desktopClient.config&&owner.revision===desktopClient.getContextRevision();
 const client=()=>desktopClient.governanceExecutionPolicies();
 const expired=Boolean(policy&&Date.parse(policy.policy.expiresAt)<=clock);
 const independent=Boolean(policy&&canApprove&&currentUserId&&policy.requesterUserId!==currentUserId&&!policy.policy.executorUserIds.includes(currentUserId));
 const parentMatches=Boolean(policy&&pointer&&(pointer.found?pointer.digest: null)===policy.policy.parentDigest);
 async function read(kind:'policy'|'pointer'|'outcome'|'saved'|'requests'){
  if(running.current||!owns()||kind==='policy'&&!executionPolicyId.safeParse(id).success||kind==='pointer'&&!policy||kind==='outcome'&&!pending)return;
  running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  try{
   if(kind==='saved'){const result=await client().list(c.signal);if(!owns())return;if(!result.ok)setMessage(result.error);else setDirectory(result.data);
   }else if(kind==='requests'){const result=await client().requests(c.signal);if(!owns())return;if(!result.ok)setMessage(result.error);else setRequests(result.data);
   }else if(kind==='policy'){
    const result=await client().read(id,c.signal);if(!owns())return;
    setChecked(false);setPointer(undefined);setPolicy(undefined);
    if(!result.ok){setMessage(result.error);return}
    if(result.data.policy.organizationId!==organizationId){setMessage('This policy does not belong to this workspace.');return}
    if(scopes.length&&!scopes.some(scope=>scope.repositoryId===result.data.policy.scope.repositoryId&&scope.resourceId===result.data.policy.scope.resourceId&&scope.environment===result.data.policy.scope.environment)){setMessage('This policy is outside the loaded baseline scopes.');return}
    setPolicy(result.data);setClock(Date.now());if(!pending)setHeld(false);
   }else if(kind==='pointer'){
    setPointer(undefined);setChecked(false);const result=await client().active(policy!.policy.scope,c.signal);if(!owns())return;
    if(!result.ok)setMessage(result.error);else setPointer(result.data);
   }else{
    const result=await client().lookup(pending!,c.signal);if(!owns())return;
    if(!result.ok)setMessage(result.error);
    else if(!result.data.found)setMessage('No confirmed original result is visible. Keep this request; it will not be sent again.');
    else{recovery.acknowledgeRequest(pending!);setPending(undefined);setPolicy(undefined);setPointer(undefined);setChecked(false);setMessage('Original result found as historical evidence. Load the exact policy and current pointer again; this receipt grants no current authority.');}
   }
  }catch{if(owns())setMessage('The read could not be confirmed. No decision was repeated.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 async function decide(kind:'approve'|'activate'|'revoke'){
  const containment=kind==='revoke'&&Boolean(policy)&&recovery.canRevoke(policy!.id);
  if(running.current||(!containment&&(recovery.blocked||held||pending))||!checked||!policy||!owns()||kind==='approve'&&(!independent||policy.status!=='proposed'||expired)||kind==='activate'&&(!canManage||policy.status!=='approved'||expired||!parentMatches)||kind==='revoke'&&(!canManage||policy.status==='revoked'||!containment))return;
  const requestId=crypto.randomUUID(),request:ExecutionPolicyMutation=kind==='approve'?{operation:kind,id:policy.id,version:0,digest:policy.policy.digest,requestId}:kind==='activate'?{operation:kind,id:policy.id,digest:policy.policy.digest,pointerVersion:pointer!.found?pointer!.pointerVersion:null,parentDigest:policy.policy.parentDigest,requestId}:{operation:kind,id:policy.id,version:policy.version as 0|1,requestId};
  running.current=true;setBusy(true);setHeld(true);setChecked(false);setPending(request);setMessage('');const c=new AbortController();active.current=c;
  try{recovery.reserve(request);if(!owns())return;const result=await client().mutate(request,c.signal);if(!owns())return;
   if(!result.ok)setMessage(result.outcomeUnconfirmed?'The policy decision is unconfirmed. Check only its original saved outcome; no automatic resubmission.':result.error+' Keep the original request for read-only recovery.');
   else{if('policy' in result.data&&(result.data.policy.organizationId!==organizationId||JSON.stringify(result.data.policy)!==JSON.stringify(policy.policy))){setMessage('The returned policy does not match the exact reviewed workspace and limits. Keep the original request for read-only recovery.');return}recovery.acknowledgeRequest(request);setPending(undefined);setPointer(undefined);if('policy' in result.data)setPolicy(result.data);setMessage('Limits recorded. This does not authorize a provider action. Load the exact policy again before another decision.');}
  }catch{if(owns())setMessage('The policy decision is unconfirmed. Check the original saved outcome; do not resubmit.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 async function observeOriginal(record:ExecutionPolicyRecoveryRecord){
  if(running.current||!owns())return;running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  try{const result=await client().observeOriginal(record.reference,{organizationId,userId:currentUserId},c.signal);if(!owns())return;
   if(!result.ok||!result.data.found){setMessage('The original paired-session outcome is unavailable or not recorded. Keep this locator; it does not allow another submission.');return}
   recovery.acknowledge(record);setPending(undefined);setPolicy(undefined);setPointer(undefined);setChecked(false);setHeld(true);
   setMessage('Original request found as historical observation only. Exact proposal content and current authority were not verified. Load the exact policy separately before any decision.');
  }catch{if(owns())setMessage('The original recovery record could not be verified. No decision was submitted or repeated.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 if(!owns())return <p role="status">Workspace changed. Load policy history in the current account.</p>;
 return <section aria-label="Execution limits" className="rounded-xl border border-white/10 p-4 space-y-4" aria-busy={busy}>
 <header><h2 className="font-medium">Execution limits</h2><p className="mt-1 text-xs text-zinc-400">A ceiling sets the maximum eligible authority. It does not authorize a provider action, enroll a baseline or replace independent action approvals.</p></header>
 {recovery.unavailable&&<p role="alert" className="text-sm text-amber-200">Local recovery history is unavailable, corrupt or incomplete. No new limits decision can be submitted while original history cannot be verified.</p>}
 {recovery.records.length>0&&<section aria-label="Original local limits requests" className="space-y-2"><p className="text-sm text-amber-200">An original limits request remains unresolved. New proposals, approvals and activations remain blocked; missing history never permits resubmission. A current authorized administrator may still revoke a separately loaded exact policy, unless an unresolved revoke already names that policy.</p>{recovery.records.map(record=><div key={record.reference.requestId} className="text-xs text-zinc-400"><p>{record.reference.operation} · {new Date(record.createdAt).toLocaleString()}</p><details><summary data-help-id="governance.execution-limits.locator">Original request locator</summary><p className="break-all">{record.reference.requestId}</p></details><button data-help-id="governance.execution-limits.observe" type="button" className="btn-secondary" disabled={busy} onClick={()=>void observeOriginal(record)}>Observe original request history</button></div>)}</section>}
 {canManage&&<GovernanceExecutionPolicyProposal organizationId={organizationId} currentUserId={currentUserId} scopes={scopes} onSaved={savedId=>{setId(savedId);setPolicy(undefined);setPointer(undefined);setChecked(false)}}/>}
 <div className="flex flex-wrap gap-2"><button data-help-id="governance.execution-limits.saved" className="btn-secondary" disabled={busy} onClick={()=>void read('saved')}>Load saved limit policies</button><button data-help-id="governance.execution-limits.decisions" className="btn-secondary" disabled={busy} onClick={()=>void read('requests')}>Load my recorded decisions</button></div>
 {directory&&<div className="space-y-2"><label className="block text-sm">Saved limit policies<select data-help-id="governance.execution-limits.directory" value={directory.items.some(p=>p.id===id)?id:''} disabled={busy} onChange={e=>{setId(e.target.value);setPolicy(undefined);setPointer(undefined);setChecked(false)}} className="mt-1 w-full rounded border border-white/15 bg-transparent p-2"><option value="">Choose a saved policy</option>{directory.items.map(p=><option key={p.id} value={p.id}>{p.status} · level {p.autonomyLevel} · {p.scope.repositoryId} · {p.scope.environment}</option>)}</select></label><p className="text-xs text-zinc-400">{directory.items.length} recent records. {directory.truncated?'More history exists; use an exact saved ID.':'This bounded list is not proof of complete history.'}</p></div>}
 {requests&&<details className="text-xs text-zinc-400" open><summary data-help-id="governance.execution-limits.history">My recorded decisions in this paired session</summary><p className="mt-2">Historical receipts only. Unrecorded or still-unconfirmed requests may not appear. Nothing will be resent.</p>{requests.items.map(r=><div key={r.requestId} className="mt-2 space-y-1"><p>{r.operation} · {new Date(r.createdAt).toLocaleString()}</p><p className="break-all">Original request {r.requestId}</p><p className="break-all">Policy digest {r.digest}</p>{r.revisionId&&<button data-help-id="governance.execution-limits.receipt-select" className="btn-secondary" disabled={busy} onClick={()=>{setId(r.revisionId!);setPolicy(undefined);setPointer(undefined);setChecked(false)}}>Select policy from this receipt</button>}</div>)}{requests.truncated&&<p>Showing the latest20 recorded decisions.</p>}</details>}
 <label className="block text-sm">Saved execution-limit policy ID<input data-help-id="governance.execution-limits.policy-id" value={id} disabled={busy} onChange={e=>{setId(e.target.value);setPolicy(undefined);setPointer(undefined);setChecked(false)}} className="mt-1 w-full rounded border border-white/15 bg-transparent p-2"/></label>
 <button data-help-id="governance.execution-limits.load" className="btn-secondary" disabled={busy||!executionPolicyId.safeParse(id).success} onClick={()=>void read('policy')}>Load exact policy</button>
 {policy&&<div className="space-y-3"><p className="text-sm">{policy.status} · version {policy.version}</p><p className="text-sm">Maximum level {policy.policy.autonomyLevel} · expires {new Date(policy.policy.expiresAt).toLocaleString()}</p><p className="text-xs text-zinc-400">{policy.policy.scope.repositoryId} · {policy.policy.scope.resourceId} · {policy.policy.scope.environment}</p><p className="text-sm">Actions: {policy.policy.actions.join(', ')}</p><p className="text-sm">Named executors: {policy.policy.executorUserIds.join(', ')}</p><p className="text-xs text-zinc-400">Requested by {policy.requesterUserId}{policy.approval?' · independently reviewed by '+policy.approval.userId:''}</p>
 <details className="text-xs text-zinc-400"><summary data-help-id="governance.execution-limits.identifiers">Exact policy identifiers</summary><p className="break-all">{policy.id}</p><p className="break-all">Digest {policy.policy.digest}</p><p className="break-all">Parent {policy.policy.parentDigest??'No prior limit pointer'}</p></details>
 {expired&&<p role="status" className="text-sm text-amber-300">These limits have expired. Historical records do not restore execution authority.</p>}
 {canManage&&policy.status==='approved'&&<button data-help-id="governance.execution-limits.pointer" className="btn-secondary" disabled={busy||Boolean(pending)} onClick={()=>void read('pointer')}>Read current limit pointer</button>}
 {pointer&&<p className="text-xs text-zinc-400">{pointer.found?'Historical pointer version '+pointer.pointerVersion+' · '+pointer.policyStatus:'No existing limit pointer'}{!parentMatches?' · parent changed; activation refused':''}</p>}
 {policy.status!=='revoked'&&<><label className="flex gap-2 text-sm"><input data-help-id="governance.execution-limits.review" type="checkbox" checked={checked} disabled={busy||(!(canManage&&recovery.canRevoke(policy.id))&&(recovery.blocked||held||Boolean(pending)))} onChange={e=>setChecked(e.target.checked)}/>I reviewed this exact scope, limit, named executors and expiry.</label>
 {policy.status==='proposed'&&<button data-help-id="governance.execution-limits.approve" className="btn-primary" disabled={busy||recovery.blocked||held||Boolean(pending)||!checked||!independent||expired} onClick={()=>void decide('approve')}>Record independent limit approval</button>}
 {canManage&&policy.status==='approved'&&<button data-help-id="governance.execution-limits.activate" className="btn-primary" disabled={busy||recovery.blocked||held||Boolean(pending)||!checked||!parentMatches||expired} onClick={()=>void decide('activate')}>Activate these limits</button>}
 {canManage&&<button data-help-id="governance.execution-limits.revoke" className="btn-secondary ml-2" disabled={busy||!recovery.canRevoke(policy.id)||!checked} onClick={()=>void decide('revoke')}>Revoke this limit policy</button>}
 {!independent&&policy.status==='proposed'&&<p className="text-xs text-zinc-400">A current authorized reviewer who neither proposed these limits nor appears as an executor must make the independent decision.</p>}</>}
 </div>}
 {pending&&<div className="space-y-2"><p className="break-all text-xs text-zinc-400">Original {pending.operation} request {pending.requestId}. Kept for read-only lookup.</p><button data-help-id="governance.execution-limits.outcome" className="btn-secondary" disabled={busy} onClick={()=>void read('outcome')}>Check original saved outcome</button></div>}
 {message&&<p role="status" className="text-sm text-zinc-300">{message}</p>}
 </section>;
}
