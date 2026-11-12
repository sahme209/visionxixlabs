import {OperationalEcsSourceDetails} from './OperationalEcsSourceDetails';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {OperationalReviewClient} from '../lib/operationalReview';
import {ecsReviewPreview,ecsReviewDecision,type EcsReviewPreview,type EcsReviewDecision} from '../../../lib/governance/platform/operations/ecsReviewContract';
interface Props{actionId:string;currentUserId:string;canApprove:boolean;client:OperationalReviewClient;onRecorded?:(decision:EcsReviewDecision)=>void}
/** Prepared review surface only. No shipping mount, borrowed identity, automatic
 * approval, delegation, workload credential or provider operation. */
export function OperationalEcsReviewPanel({actionId,currentUserId,canApprove,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,actionId,currentUserId,client}).current;
 const latest=useRef({actionId,currentUserId,client,canApprove});latest.current={actionId,currentUserId,client,canApprove};
 const alive=useRef(true),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [preview,setPreview]=useState<EcsReviewPreview|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[recorded,setRecorded]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&latest.current.actionId===owner.actionId&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const independent=Boolean(preview&&preview.requesterUserId!==currentUserId),expired=Boolean(preview&&Date.parse(preview.manifest.expiresAt)<=Date.now());
 const eligible=canApprove&&independent&&preview?.status==='proposed'&&!expired&&!held&&!recorded;
 async function run(kind:'load'|'review'){
  if(!owns()||running.current||kind==='review'&&(!eligible||!checked||attempted.current||!latest.current.canApprove||!preview||Date.parse(preview.manifest.expiresAt)<=Date.now()))return;
  running.current=true;const controller=new AbortController();active.current=controller;setBusy(true);setMessage('');setChecked(false);
  if(kind==='load')setPreview(null);else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='load'){
    const response=await client.preview(actionId,controller.signal);if(!owns())return;
    if(!response.ok)throw Error('unavailable');const parsed=ecsReviewPreview.safeParse(response.data);if(!parsed.success||parsed.data.actionId!==actionId)throw Error('mismatched');setPreview(parsed.data);setMessage('Exact saved proposal loaded. Approval records your decision only.');
   }else if(preview){
    const response=await client.review(preview,controller.signal);if(!owns())return;
    if(!response.ok)throw Error('unconfirmed');const decision=ecsReviewDecision.safeParse(response.data);if(!decision.success||decision.data.actionId!==actionId||decision.data.planDigest!==preview.planDigest)throw Error('mismatched');setRecorded(true);setMessage('Independent approval recorded. No deployment or credential was created.');try{onRecorded?.(decision.data)}catch{setMessage('Independent approval recorded. Reload original history to refresh the surrounding view.')}
   }
  }catch{if(owns())setMessage(kind==='load'?'Exact proposal is unavailable or changed. Approval remains unavailable.':'Approval outcome is unconfirmed. Inspect the original saved record; do not submit again automatically.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the exact saved review.</p>;
 const m=preview?.manifest;
 return <section aria-label="Exact ECS review" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-5">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Platform deployment · prepared locally</p><h2 className="mt-2 text-xl font-medium">Review one exact ECS change</h2><p className="mt-2 text-sm text-zinc-400">Check the deployment target and original workflow run. Approval does not deploy, delegate a workload or issue credentials.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Load exact ECS proposal</button>
  {m&&preview&&<>
   <OperationalEcsSourceDetails preview={preview}/>
   {expired&&<p role="alert">The review window expired. Historical approval does not authorize another attempt.</p>}
   {!independent&&<p className="text-sm text-zinc-400">Another authorized person must make the independent decision on your proposal.</p>}
   {preview.status==='approved'||recorded?<p>Independent decision recorded. The original requester must continue separately; nothing executes here.</p>:<div className="space-y-3 border-t border-white/10 pt-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy} onChange={event=>setChecked(event.target.checked)}/>I reviewed this exact deployment, workflow run and source evidence.</label><button type="button" className="btn-primary" disabled={!eligible||!checked||busy} onClick={()=>void run('review')}>Record independent ECS approval</button></div>}
  </>}
  <p role="status" aria-live="polite" className="text-sm">{busy?'Checking the exact saved record…':message}</p>
 </section>;
}
