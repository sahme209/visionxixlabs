import {OperationalEcsSourceDetails} from './OperationalEcsSourceDetails';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {OperationalDelegationClient} from '../lib/operationalReview';
import {ecsReviewPreview,ecsDelegationReceipt,type EcsReviewPreview,type EcsDelegationReceipt} from '../../../lib/governance/platform/operations/ecsReviewContract';
interface Props{actionId:string;currentUserId:string;canDelegate:boolean;client:OperationalDelegationClient;onRecorded?:(decision:EcsDelegationReceipt)=>void;onDelegationKnown?:(delegated:boolean)=>void}
/** Prepared requester delegation surface only. No shipping mount, approval,
 * workflow dispatch, credential issuance or provider operation. */
export function OperationalEcsDelegationPanel({actionId,currentUserId,canDelegate,client,onRecorded,onDelegationKnown}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,actionId,currentUserId,client}).current;
 const latest=useRef({actionId,currentUserId,client,canDelegate});latest.current={actionId,currentUserId,client,canDelegate};
 const alive=useRef(true),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [preview,setPreview]=useState<EcsReviewPreview|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[recorded,setRecorded]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&latest.current.actionId===owner.actionId&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const requester=Boolean(preview&&preview.requesterUserId===currentUserId),expired=Boolean(preview&&Date.parse(preview.manifest.expiresAt)<=Date.now());
 const eligible=canDelegate&&requester&&preview?.status==='approved'&&preview.delegationState==='not_delegated'&&!expired&&!held&&!recorded;
 async function run(kind:'load'|'delegate'){
  if(!owns()||running.current||kind==='delegate'&&(!eligible||!checked||attempted.current||!latest.current.canDelegate||!preview||Date.parse(preview.manifest.expiresAt)<=Date.now()))return;
  running.current=true;const controller=new AbortController();active.current=controller;setBusy(true);setMessage('');setChecked(false);
  if(kind==='load')setPreview(null);else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='load'){
    const response=await client.preview(actionId,controller.signal);if(!owns())return;
    if(!response.ok)throw Error('unavailable');const parsed=ecsReviewPreview.safeParse(response.data);if(!parsed.success||parsed.data.actionId!==actionId||parsed.data.status!=='approved')throw Error('mismatched');setPreview(parsed.data);try{onDelegationKnown?.(parsed.data.delegationState==='delegated')}catch{/* presentation hint only */}setMessage('Exact approved run loaded. Confirm only this already-approved workflow run.');
   }else if(preview){
    const response=await client.delegate(preview,controller.signal);if(!owns())return;
    if(!response.ok)throw Error('unconfirmed');const decision=ecsDelegationReceipt.safeParse(response.data);if(!decision.success||decision.data.actionId!==actionId||decision.data.manifest.digest!==preview.manifest.digest||decision.data.requesterUserId!==preview.requesterUserId||decision.data.reviewerUserId!==preview.reviewerUserId)throw Error('mismatched');setRecorded(true);try{onDelegationKnown?.(true)}catch{/* presentation hint only */}setMessage('Delegation recorded. No workflow was started, credential issued or deployment sent.');try{onRecorded?.(decision.data)}catch{setMessage('Delegation recorded. Reload original history to refresh the surrounding view.')}
   }
  }catch{if(owns())setMessage(kind==='load'?'Exact approved run is unavailable or changed. Delegation remains unavailable.':'Delegation outcome is unconfirmed. Inspect the original saved record; do not submit again automatically.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the exact saved review.</p>;
 const m=preview?.manifest;
 return <section aria-label="Exact ECS delegation" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-5">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Platform deployment · prepared locally</p><h2 className="mt-2 text-xl font-medium">Delegate one exact workflow run</h2><p className="mt-2 text-sm text-zinc-400">Confirm the approved target and already-created workflow run. This records delegation only; it does not dispatch the workflow or issue credentials.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Load approved workflow run</button>
  {m&&preview&&<>
   <OperationalEcsSourceDetails preview={preview}/>
   {expired&&<p role="alert">The approved window expired. Historical approval does not authorize delegation.</p>}
   {!requester&&<p className="text-sm text-zinc-400">Only the original requester in the original authorized session may confirm delegation.</p>}
   {recorded||preview.delegationState==='delegated'?<p>Delegation recorded for this exact run. Current workload authentication and all execution gates remain required.</p>:<div className="space-y-3 border-t border-white/10 pt-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy} onChange={event=>setChecked(event.target.checked)}/>I authorize only this exact approved deployment and workflow run.</label><button type="button" className="btn-primary" disabled={!eligible||!checked||busy} onClick={()=>void run('delegate')}>Delegate this exact workflow run</button></div>}
  </>}
  <p role="status" aria-live="polite" className="text-sm">{busy?'Checking the exact saved record…':message}</p>
 </section>;
}
