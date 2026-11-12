import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {PlatformExecutionClient} from '../lib/platformReview';
import {platformInspectionSchema,platformGrowthPreviewSchema,type PlatformInspection,type PlatformGrowthPreview} from '../../../lib/governance/platform/viewContract';
import {PlatformActionSummary,PlatformSourcePreview} from './PlatformActionSummary';
interface Props{action:PlatformInspection;currentUserId:string;canExecute:boolean;client:PlatformExecutionClient;onRecorded:(action:PlatformInspection)=>void}
/** Prepared, unregistered requester confirmation. It cannot approve a plan,
 * change its target, renew expiry, create a replacement or retry automatically. */
export function PlatformExecutionPanel(props:Props){const parsed=platformInspectionSchema.safeParse(props.action);if(!parsed.success)return <p role="alert">This saved action cannot be verified. Load its original record.</p>;return <ExactExecution key={parsed.data.actionId+':'+parsed.data.version+':'+parsed.data.plan.digest+':'+props.currentUserId} {...props} action={parsed.data}/>}
function ExactExecution({action,currentUserId,canExecute,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const[preview,setPreview]=useState<PlatformGrowthPreview|undefined>(),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState(''),[clock,setClock]=useState(Date.now());
 const running=useRef(false),alive=useRef(true),active=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>{alive.current=false;clearInterval(timer);active.current?.abort()}},[]);
 const owns=()=>alive.current&&revision===owner.revision&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 const expired=action.expired||Math.max(clock,Date.now())>=Date.parse(action.plan.expiresAt),supported=action.plan.effects.length===1&&['growth.post.publish','growth.schedule.change','growth.post.delete'].includes(action.plan.effects[0].kind),requester=Boolean(currentUserId)&&currentUserId===action.requesterUserId,eligible=requester&&canExecute&&supported&&action.status==='approved'&&!expired&&Boolean(preview)&&!held;
 async function run(kind:'inspect'|'preview'|'execute'){
  if(!owns()||running.current||kind==='execute'&&(!eligible||!checked||Date.now()>=Date.parse(action.plan.expiresAt))||kind==='preview'&&(!supported||action.status!=='approved'||expired))return;
  running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  if(kind==='execute'){setHeld(true);setChecked(false)}if(kind==='inspect'){setPreview(undefined);setChecked(false)}
  try{
   const result=kind==='inspect'?await client.inspect(action.actionId,c.signal):kind==='preview'?await client.preview(action,c.signal):await client.execute(action,c.signal);if(!owns())return;
   if(!result.ok){setMessage(kind==='execute'?'Execution outcome is unconfirmed. Inspect this same saved action. Do not resend or create a replacement.':kind==='preview'?'The exact source is unavailable or changed. Execution stays unavailable.':'Saved history is unavailable. Keep the original action for inspection.');return}
   if(kind==='preview'){const p=platformGrowthPreviewSchema.safeParse(result.data);if(!p.success||p.data.actionId!==action.actionId||p.data.planDigest!==action.plan.digest||p.data.sourceDigest!==action.plan.sourceDigest||p.data.effectId!==action.plan.effects[0].id){setMessage('The source does not match this approved plan. Execution stays unavailable.');return}setPreview(p.data);setChecked(false);setMessage('Exact source loaded. Inspect the approved operation before confirming once.');return}
   const saved=platformInspectionSchema.safeParse(result.data);
   if(!saved.success||saved.data.actionId!==action.actionId||saved.data.version<action.version||JSON.stringify(saved.data.plan)!==JSON.stringify(action.plan)||saved.data.requesterUserId!==action.requesterUserId||saved.data.reviewerUserId!==action.reviewerUserId||kind==='execute'&&saved.data.status!=='confirmed'){setMessage('The result does not match this saved action. Inspect the original record; do not resend.');return}
   if(kind==='inspect'&&saved.data.status==='approved'&&saved.data.attemptCount===0)setHeld(false);
   onRecorded(saved.data);setMessage(kind==='execute'?'The approved operation is confirmed in its saved history.':'Saved record refreshed. A consumed attempt cannot be executed again.');
  }catch{if(owns())setMessage('The saved outcome is unconfirmed. Inspect the same action; no automatic resend.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 if(!owns())return <p role="status">Account context changed. Load this saved action in the original account.</p>;
 return <section aria-label="Exact requester execution" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
 <header className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-zinc-400">Requester confirmation</p><h2 className="mt-1 text-lg font-medium">One approved operation</h2><p className="mt-2 text-sm text-zinc-400">{action.status} · version {action.version} · {action.attemptCount} attempt recorded</p></div><button className="btn-secondary" disabled={busy} onClick={()=>void run('inspect')}>Inspect saved action</button></header>
 <p className="text-sm text-zinc-400">Independent review and execution are separate. The server checks the original sign-in session, current permissions, source and expiry again.</p>
 {['claimed','unknown'].includes(action.status)&&<p role="alert" className="rounded-lg border border-amber-400/30 p-3 text-sm">This action already has a consumed attempt. Do not resend or create a replacement. Inspect its original history and outcome.</p>}
 {expired&&<p role="status" className="text-sm">This window has expired. Historical approval cannot authorize another attempt.</p>}
 <PlatformActionSummary action={action}/>
 {action.status==='approved'&&<div className="space-y-3 border-t border-white/10 pt-4"><button className="btn-secondary" disabled={busy||expired||!supported} onClick={()=>void run('preview')}>Load exact source preview</button>{preview&&<PlatformSourcePreview preview={preview}/>}<label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy} onChange={e=>setChecked(e.target.checked)}/>I authorize this one exact approved operation.</label><button className="btn-primary" disabled={!eligible||!checked||busy} onClick={()=>void run('execute')}>Execute this one approved action</button>{!requester&&<p className="text-xs text-zinc-400">Only the original requester may execute, using the original sign-in session.</p>}{!supported&&<p className="text-xs text-zinc-400">Execution for this operation is not available here yet.</p>}</div>}
 {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
