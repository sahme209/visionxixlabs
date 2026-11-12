import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {PlatformReviewClient} from '../lib/platformReview';
import {platformInspectionSchema,type PlatformInspection} from '../../../lib/governance/platform/viewContract';
import type {PlatformEffect} from '../../../lib/governance/platform/contracts';
interface Props{action:PlatformInspection;currentUserId:string;canApprove:boolean;client:PlatformReviewClient;onRecorded:(action:PlatformInspection)=>void}
const titles:Record<PlatformEffect['kind'],string>={'deployment.vercel':'Deploy to Vercel','deployment.ecs':'Change ECS deployment','settings.vercel':'Change Vercel settings','template.bucket.create':'Create template bucket','template.object.put':'Upload exact template','template.access.grant':'Grant temporary template access','growth.image.initialize':'Prepare LinkedIn image upload','growth.image.put':'Upload exact LinkedIn image','growth.post.publish':'Publish LinkedIn post','growth.post.delete':'Delete exact LinkedIn post','growth.schedule.change':'Change publication schedule'};
const fieldNames:Record<string,string>={projectName:'Project',projectId:'Project',teamId:'Team',environment:'Environment',projectCreation:'Project creation',accountId:'AWS account',region:'Region',bucket:'Bucket',key:'Object',objectVersion:'Object version',ttlSeconds:'Access duration (seconds)',connectionId:'Connected account',author:'Author',draftId:'Draft',postUrn:'Post',scheduledFor:'New publication time',cluster:'Cluster',service:'Service',taskDefinitionArn:'Task definition',operation:'Operation',destinationOrigin:'Upload origin',apiVersion:'API version'};
/** Prepared, unregistered panel. It never executes an operation; actual server
 * review and source gates remain authoritative. No live acceptance is implied. */
export function PlatformReviewPanel(props:Props){
 const parsed=platformInspectionSchema.safeParse(props.action);if(!parsed.success)return <p role="alert">This saved action cannot be verified. Load it again before reviewing.</p>;
 return <ExactPlatformReview key={parsed.data.actionId+':'+parsed.data.version+':'+parsed.data.plan.digest+':'+props.currentUserId} {...props} action={parsed.data}/>;
}
function ExactPlatformReview({action,currentUserId,canApprove,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState(''),[clock,setClock]=useState(Date.now());
 const alive=useRef(true),running=useRef(false),active=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>{alive.current=false;clearInterval(timer);active.current?.abort()}},[]);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 const expired=action.expired||Math.max(clock,Date.now())>=Date.parse(action.plan.expiresAt),independent=Boolean(currentUserId)&&currentUserId!==action.requesterUserId,eligible=canApprove&&independent&&action.status==='proposed'&&!expired;
 async function run(kind:'inspect'|'approve'){
  if(!owns()||running.current||kind==='approve'&&(!eligible||held||!checked||Date.now()>=Date.parse(action.plan.expiresAt)))return;
  running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  if(kind==='approve'){setHeld(true);setChecked(false)}
  try{
   const result=kind==='inspect'?await client.inspect(action.actionId,c.signal):await client.approve(action,c.signal);if(!owns())return;
   if(!result.ok){setMessage(kind==='approve'?'Decision outcome is unconfirmed. Inspect this saved action; do not resubmit automatically.':'Saved history is unavailable. The previous record is historical.');return}
   const saved=platformInspectionSchema.safeParse(result.data);
   if(!saved.success||saved.data.actionId!==action.actionId||saved.data.plan.digest!==action.plan.digest||saved.data.version<action.version||JSON.stringify(saved.data.plan)!==JSON.stringify(action.plan)||kind==='approve'&&saved.data.reviewerUserId!==currentUserId){setMessage('The response does not match this exact review. Inspect the saved action before continuing.');return}
   if(kind==='inspect')setHeld(false);
   onRecorded(saved.data);setMessage(kind==='approve'?'Independent decision recorded. No operation was executed.':'Saved record refreshed. Source and execution eligibility are checked separately.');
  }catch{if(owns())setMessage('The saved outcome is unconfirmed. Inspect this same action; no automatic resend.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 if(revision!==owner.revision||desktopClient.config!==owner.config)return <p role="status">Account context changed. Load the saved platform action again.</p>;
 return <section aria-label="Exact platform review" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-zinc-400">Platform operation</p><h2 className="mt-1 text-lg font-medium">Review the exact change</h2><p className="mt-2 text-sm text-zinc-400">{action.status} · version {action.version} · {action.attemptCount} attempt recorded</p></div><button className="btn-secondary" disabled={busy} onClick={()=>void run('inspect')}>Inspect saved action</button></header>
  <p className="text-sm text-zinc-400">Approval records an independent decision. It does not execute a change or establish current source validation.</p>
  {action.status==='unknown'&&<p role="alert" className="rounded-lg border border-amber-400/30 p-3 text-sm">The outcome is unknown. Do not resend or create a replacement action. Inspect the original record before recovery.</p>}
  {expired&&<p role="status" className="text-sm">The review window has expired. Historical approval cannot authorize another attempt.</p>}
  <ol className="divide-y divide-white/10">{action.plan.effects.map((effect,index)=><li key={effect.id} className="py-4"><div className="flex justify-between gap-3"><h3 className="text-sm font-medium">{titles[effect.kind]}</h3><span className="text-xs text-zinc-400">{action.effects[index].status.replace('_',' ')}</span></div><dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(effect.target).filter(([name])=>fieldNames[name]).map(([name,value])=><div key={name}><dt className="text-xs text-zinc-400">{fieldNames[name]}</dt><dd className="mt-1 break-all text-sm">{String(value)}</dd></div>)}</dl><details className="mt-3 text-xs text-zinc-400"><summary>Exact content and evidence references</summary>{Object.entries(effect.target).filter(([name])=>!fieldNames[name]).map(([name,value])=><p key={name} className="mt-2 break-all">{name}: {String(value)}</p>)}</details></li>)}</ol>
  <details className="text-xs text-zinc-400"><summary>Review identity and history</summary><p className="mt-2 break-all">{action.actionId}</p><p className="mt-2 break-all">Plan {action.plan.digest}</p><p className="mt-2">Requested by {action.requesterUserId}</p><p>Reviewed by {action.reviewerUserId??'Not yet reviewed'}</p><p>Expires {new Date(action.plan.expiresAt).toLocaleString()}</p></details>
  {action.status==='proposed'&&<div className="border-t border-white/10 pt-4 space-y-3"><p className="text-xs text-zinc-400">Content is identified by digest. Inspect its original source before recording a decision.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy||held} onChange={e=>setChecked(e.target.checked)}/>I reviewed these exact operations and target references.</label><button className="btn-primary" disabled={!eligible||!checked||busy||held} onClick={()=>void run('approve')}>Record independent approval</button>{!independent&&<p className="text-xs text-zinc-400">Another authorized person must review your proposal.</p>}</div>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
