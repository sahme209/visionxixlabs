import {useExecutionPolicyRecovery} from '../lib/useExecutionPolicyRecovery';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {z} from 'zod';
import {desktopClient} from '../lib/desktopClient';
import {executionPolicyActions,executionPolicyProposalSchema,type ExecutionPolicyMutation,type ExecutionPolicyPointer} from '../lib/governanceExecutionPolicy';
interface Props {organizationId:string;currentUserId:string;scopes:Array<{repositoryId:string;resourceId:string;environment:'production'|'staging'|'development'|'qa'}>;onSaved:(id:string)=>void}
const member=z.object({userId:z.string().min(1).max(256),role:z.enum(['owner','admin','operator','security_reviewer','finance_viewer','read_only']),email:z.string().min(1).max(320),displayName:z.string().max(256).optional(),acceptedAt:z.string().datetime().nullable(),updatedAt:z.string().datetime()}).strict();
export function GovernanceExecutionPolicyProposal(props:Props){const rev=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);return <Proposal key={rev+':'+props.organizationId+':'+props.currentUserId+':'+JSON.stringify(props.scopes)} {...props}/>}
function Proposal({organizationId,currentUserId,scopes,onSaved}:Props){
 const recovery=useExecutionPolicyRecovery(organizationId,currentUserId);
 const owner=useRef({config:desktopClient.config,revision:desktopClient.getContextRevision()}).current,alive=useRef(true),running=useRef(false),controller=useRef<AbortController|undefined>(undefined);
 const[index,setIndex]=useState('0'),[members,setMembers]=useState<Array<z.infer<typeof member>>>([]),[executors,setExecutors]=useState<string[]>([]),[actions,setActions]=useState<string[]>(['repository.merge']),[level,setLevel]=useState('4'),[expiry,setExpiry]=useState(''),[pointer,setPointer]=useState<ExecutionPolicyPointer>(),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[pending,setPending]=useState<ExecutionPolicyMutation>(),[message,setMessage]=useState(''),[clock,setClock]=useState(Date.now());
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setClock(Date.now()),15000);return()=>{alive.current=false;controller.current?.abort();clearInterval(timer)}},[]);
 const owns=()=>alive.current&&owner.config===desktopClient.config&&owner.revision===desktopClient.getContextRevision(),scope=scopes[Number(index)];
 const expires=expiry?new Date(expiry).getTime():NaN,raw={scope,parentDigest:pointer?.found?pointer.digest:null,autonomyLevel:Number(level),actions,executorUserIds:executors,expiresAt:Number.isFinite(expires)?new Date(expires).toISOString():''},proposal=executionPolicyProposalSchema.safeParse(raw);
 const valid=proposal.success&&expires>clock&&Boolean(pointer)&&JSON.stringify(pointer!.scope)===JSON.stringify(scope)&&executors.every(id=>members.some(m=>m.userId===id));
 function edit(){setChecked(false)}
 async function read(kind:'members'|'parent'|'outcome'){
  if(running.current||!owns()||kind==='parent'&&(!scope||held)||kind==='outcome'&&!pending)return;
  running.current=true;setBusy(true);setMessage('');const c=new AbortController();controller.current=c;
  try{
   if(kind==='members'){
    setMembers([]);setExecutors([]);setChecked(false);const result=await desktopClient.listWorkspaceMembers();if(!owns())return;
    if(!result.ok){setMessage('Current workspace members could not be verified. No policy was saved.');return}
    const parsed=z.object({currentUserId:z.literal(currentUserId),members:z.array(member).max(1000)}).passthrough().safeParse(result.data);
    if(!parsed.success||new Set(parsed.data.members.map(m=>m.userId)).size!==parsed.data.members.length){setMessage('Current workspace members could not be verified.');return}
    setMembers(parsed.data.members.filter(m=>m.acceptedAt&&Date.parse(m.acceptedAt)<=Date.now()&&['owner','admin','operator'].includes(m.role)));
   }else if(kind==='parent'){
    setPointer(undefined);setChecked(false);const result=await desktopClient.governanceExecutionPolicies().active(scope,c.signal);if(!owns())return;if(result.ok)setPointer(result.data);else setMessage(result.error);
   }else{
    const result=await desktopClient.governanceExecutionPolicies().lookup(pending!,c.signal);if(!owns())return;
    if(!result.ok)setMessage(result.error);else if(!result.data.found)setMessage('No confirmed original proposal is visible. Keep this request; it will not be resent.');
    else if('policy' in result.data.result&&result.data.result.policy.organizationId===organizationId){recovery.acknowledgeRequest(pending!);setPending(undefined);setMessage('Original proposal found as historical evidence. Load its current revision before any decision.');onSaved(result.data.result.id)}
    else setMessage('The historical proposal does not match this workspace. Keep the original request.');
   }
  }catch{if(owns())setMessage('The read could not be verified. No proposal was repeated.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 async function save(){
  if(running.current||recovery.blocked||held||!checked||!valid||!proposal.success||!owns())return;
  const request:ExecutionPolicyMutation={operation:'propose',policy:proposal.data,requestId:crypto.randomUUID()};running.current=true;setBusy(true);setHeld(true);setPending(request);setChecked(false);setMessage('');const c=new AbortController();controller.current=c;
  try{recovery.reserve(request);if(!owns())return;const result=await desktopClient.governanceExecutionPolicies().mutate(request,c.signal);if(!owns())return;
   if(result.ok&&'policy' in result.data&&result.data.policy.organizationId===organizationId){recovery.acknowledgeRequest(request);setPending(undefined);setMessage('Proposal saved for a separate independent reviewer. No limits or baseline were activated.');onSaved(result.data.id)}
   else setMessage('Proposal outcome is unconfirmed. Check only the original saved outcome; do not resubmit.');
  }catch{if(owns())setMessage('Proposal outcome is unconfirmed. Check only the original saved outcome; do not resubmit.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 if(!owns())return <p role="status">Workspace changed. Prepare a fresh proposal in the current account.</p>;
 const disabled=busy||held||recovery.blocked;
 return <section aria-label="Propose execution limits" className="rounded-xl border border-white/10 p-4 space-y-3" aria-busy={busy}>
 <header><h3 className="font-medium">Propose execution limits</h3><p className="mt-1 text-xs text-zinc-400">Choose an exact scope from a loaded baseline and current workspace members. Limits grant no new permission or executor coverage. Saving requires another authorized person to review.</p></header>
 {recovery.unavailable&&<p role="alert">Local recovery history could not be verified. No proposal can be submitted.</p>}
 {!scopes.length&&<p role="status" className="text-sm">Load a baseline from this workspace before proposing limits.</p>}
 <label className="block text-sm">Exact policy scope<select value={index} disabled={disabled||!scopes.length} onChange={e=>{setIndex(e.target.value);setPointer(undefined);edit()}} className="mt-1 block w-full rounded border border-white/15 bg-transparent p-2">{scopes.map((s,i)=><option key={JSON.stringify(s)} value={String(i)}>{s.repositoryId} · {s.resourceId} · {s.environment}</option>)}</select></label>
 <button className="btn-secondary" disabled={disabled} onClick={()=>void read('members')}>Load current workspace members</button>
 <fieldset disabled={disabled} className="space-y-2"><legend className="text-sm">Named executors</legend>{members.map(m=><label key={m.userId} className="flex gap-2 text-sm"><input type="checkbox" checked={executors.includes(m.userId)} onChange={e=>{setExecutors(e.target.checked?[...executors,m.userId]:executors.filter(id=>id!==m.userId));edit()}}/>{m.displayName||m.email} · {m.role}</label>)}<p className="text-xs text-zinc-400">Only accepted owner, administrator and operator records are offered. Their actual action rights are rechecked by the server. Named executors cannot independently approve this proposal.</p></fieldset>
 <label className="block text-sm">Maximum numeric level<select value={level} disabled={disabled} onChange={e=>{setLevel(e.target.value);edit()}} className="ml-2 rounded border border-white/15 bg-transparent p-2">{[0,1,2,3,4,5].map(n=><option key={n} value={String(n)}>Level {n}</option>)}</select></label>
 <p className="text-xs text-zinc-400">Level0 permits eligible observations, level1 adds recommendations, and mutations require at least4 plus all existing exact approvals and platform checks. A higher ceiling never removes those checks.</p>
 <label className="block text-sm">Eligible actions<select multiple value={actions} disabled={disabled} onChange={e=>{setActions(Array.from(e.target.selectedOptions,o=>o.value));edit()}} className="mt-1 block w-full rounded border border-white/15 bg-transparent p-2">{executionPolicyActions.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
 <label className="block text-sm">Limit expiry<input type="datetime-local" value={expiry} disabled={disabled} onChange={e=>{setExpiry(e.target.value);edit()}} className="ml-2 rounded border border-white/15 bg-transparent p-2"/></label>
 <p className="text-xs text-zinc-400">{Number.isFinite(expires)?'Absolute expiry '+new Date(expires).toISOString():'Choose a future expiry in your local time.'}</p>
 <button className="btn-secondary" disabled={disabled||!scope} onClick={()=>void read('parent')}>Read exact current limit parent</button>
 {pointer&&<p className="break-all text-xs text-zinc-400">{pointer.found?'Current parent '+pointer.digest+' · pointer version '+pointer.pointerVersion:'No current limit pointer. This proposes an initial policy.'}</p>}
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={disabled||!valid} onChange={e=>setChecked(e.target.checked)}/>I reviewed this exact proposal and its named executors.</label>
 <button className="btn-primary" disabled={disabled||!valid||!checked} onClick={()=>void save()}>Save limits for independent review</button>
 {pending&&<div><p className="break-all text-xs text-zinc-400">Original proposal request {pending.requestId}</p><button className="btn-secondary mt-2" disabled={busy} onClick={()=>void read('outcome')}>Check original proposal outcome</button></div>}
 {message&&<p role="status" className="text-sm text-zinc-300">{message}</p>}
 </section>;
}
