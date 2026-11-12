import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {DeploymentRecoveryClient} from '../lib/deploymentRecovery';
import {deploymentRecoveryPreview,deploymentRecoveryHistory,deploymentRecoveryReviewReceipt,deploymentRecoveryObservationReceipt,type DeploymentRecoveryPreview,type DeploymentRecoveryHistory} from '../../../lib/governance/platform/deploymentRecoveryClientContract';
interface Props{actionId:string;expectedPlanDigest:string;currentUserId:string;canApprove:boolean;canObserve:boolean;consumed?:boolean;client:DeploymentRecoveryClient;onRecorded?:()=>void}
/** Prepared exact recovery decisions/history. Client capability props are only
 * presentation hints; current server authority and private evidence decide. */
export function DeploymentRecoveryPanel({actionId,expectedPlanDigest,currentUserId,canApprove,canObserve,consumed=false,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,apiBase:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,actionId,expectedPlanDigest,currentUserId,client}).current;
 const latest=useRef({actionId,expectedPlanDigest,currentUserId,client,canApprove,canObserve});latest.current={actionId,expectedPlanDigest,currentUserId,client,canApprove,canObserve};
 const alive=useRef(true),invalidated=useRef(false),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [preview,setPreview]=useState<DeploymentRecoveryPreview|null>(null),[history,setHistory]=useState<DeploymentRecoveryHistory|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[knownConsumed,setKnownConsumed]=useState(consumed),[message,setMessage]=useState('');
 function owns(){const same=desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&desktopClient.config.apiBase===owner.apiBase&&desktopClient.config.sessionToken===owner.token&&latest.current.actionId===owner.actionId&&latest.current.expectedPlanDigest===owner.expectedPlanDigest&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;if(!same)invalidated.current=true;return alive.current&&!invalidated.current&&same}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const requester=preview?.requesterUserId===currentUserId,expired=Boolean(preview&&Date.parse(preview.plan.expiresAt)<=Date.now()),used=consumed||knownConsumed;
 const reviewable=Boolean(preview?.status==='proposed'&&!requester&&canApprove&&!expired&&!held&&!used),observable=Boolean(preview?.status==='approved'&&requester&&canObserve&&!expired&&!held&&!used);
 async function run(kind:'preview'|'history'|'review'|'observe'){
  if(!owns()||running.current||kind==='preview'&&used||['review','observe'].includes(kind)&&(!preview||!checked||attempted.current||Date.parse(preview.plan.expiresAt)<=Date.now()||kind==='review'&&(!reviewable||!latest.current.canApprove)||kind==='observe'&&(!observable||!latest.current.canObserve)))return;
  running.current=true;const c=new AbortController();active.current=c;setBusy(true);setChecked(false);setMessage('');
  if(kind==='preview'||kind==='history'){setPreview(null);setHistory(null)}else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='preview'){
    const result=await client.preview(actionId,c.signal);if(!owns())return;if(!result.ok)throw Error('unavailable');const p=deploymentRecoveryPreview.safeParse(result.data);if(!p.success||p.data.actionId!==actionId||p.data.planDigest!==expectedPlanDigest)throw Error('mismatch');setPreview(p.data);setMessage('Exact recovery preview loaded. Choose only your own next decision.');
   }else if(kind==='history'){
    const result=await client.inspect(actionId,c.signal);if(!owns())return;if(!result.ok)throw Error('unavailable');const p=deploymentRecoveryHistory.safeParse(result.data);if(!p.success||p.data.actionId!==actionId||p.data.planDigest!==expectedPlanDigest)throw Error('mismatch');setHistory(p.data);if(p.data.attemptCount===1)setKnownConsumed(true);setMessage('Saved outcome loaded. No provider observation was repeated.');
   }else if(preview){
    const result=await (kind==='review'?client.review(preview,c.signal):client.observe(preview,c.signal));if(!owns())return;if(!result.ok)throw Error('unconfirmed');const receipt=(kind==='review'?deploymentRecoveryReviewReceipt:deploymentRecoveryObservationReceipt).safeParse(result.data);if(!receipt.success||receipt.data.actionId!==actionId||receipt.data.planDigest!==expectedPlanDigest)throw Error('mismatch');
    if(kind==='observe')setKnownConsumed(true);
    setMessage(kind==='review'?'Approval recorded. The original requester must observe separately.':'Terminal observation recorded and this generation released. Read the saved outcome; a later deployment needs its own reviewed action.');
    try{onRecorded?.()}catch{/* Known committed result remains known if surrounding refresh fails. */}
   }
  }catch{if(owns())setMessage(kind==='preview'||kind==='history'?'Original recovery data is unavailable. Keep the same reference; no decision was submitted.':'Recovery result is unconfirmed. Read this same saved outcome; do not repeat automatically.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen this exact recovery record.</p>;
 const plan=preview?.plan??history?.plan;
 return <section aria-label="Exact deployment recovery" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-5">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Deployment recovery · prepared locally</p><h2 className="mt-2 text-xl font-medium">Resolve one held deployment generation</h2><p className="mt-2 text-sm text-zinc-400">Review the original receipt, then let the original requester make one read-only terminal observation. Only qualified evidence can release the exact held generation.</p></header>
  <div className="flex flex-wrap gap-3">{!used&&<button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('preview')}>Load exact recovery preview</button>}<button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('history')}>Read saved recovery outcome</button></div>
  {plan&&<><dl className="grid gap-3 sm:grid-cols-2"><div><dt>Project</dt><dd>{plan.target.projectName}</dd></div><div><dt>Team / environment</dt><dd>{plan.target.teamId} / {plan.target.environment}</dd></div><div><dt>Original provider deployment</dt><dd>{plan.providerDeploymentId}</dd></div><div><dt>Exact generation</dt><dd>{plan.generation}</dd></div></dl><details><summary>Original receipt and review references</summary><p className="break-all">Recovery: {actionId}</p><p className="break-all">Original action: {plan.originalActionId}</p><p className="break-all">Original receipt: {plan.requestReceiptId}</p><p className="break-all">Receipt digest: {plan.requestReceiptDigest}</p><p className="break-all">Review plan: {expectedPlanDigest}</p><p className="break-all">Qualified profile: {plan.profileDigest}</p><p>Expected target version: {plan.expectedReservationVersion}</p></details></>}
  {preview&&<>
   <p>Review expires {preview.plan.expiresAt} · {preview.status}</p>{expired&&<p role="alert">This review window expired. Reading history cannot renew it.</p>}
   {preview.status==='proposed'&&requester&&<p>Another authorized person must make the independent decision.</p>}{preview.status==='approved'&&!requester&&<p>The original requester must perform the separate observation in the original session.</p>}
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy||!reviewable&&!observable} onChange={e=>setChecked(e.target.checked)}/>{preview.status==='proposed'?'I personally reviewed this exact target, original receipt and release scope.':'I authorize one terminal observation of this exact approved generation.'}</label>
   {preview.status==='proposed'?<button type="button" className="btn-primary" disabled={busy||!checked||!reviewable} onClick={()=>void run('review')}>Record independent recovery approval</button>:<button type="button" className="btn-primary" disabled={busy||!checked||!observable} onClick={()=>void run('observe')}>Observe this deployment once</button>}
  </>}
  {history&&<><h3 className="font-medium">Recorded outcome</h3><p>{history.status} · {history.attemptCount} attempt</p><p className="text-sm text-zinc-400">Historical evidence does not check current target availability or deployment readiness.</p>{history.observation?<p>Generation {history.observation.generation} was recorded as terminal and safe to release at {new Date(history.observation.observedAt).toISOString()}.</p>:<p>No terminal release observation is recorded.</p>}{['claimed','unknown'].includes(history.status)&&<p role="alert">This attempt is consumed or uncertain. Keep its original record; do not repeat it or create an automatic replacement.</p>}</>}
  <p role="status" aria-live="polite">{busy?'Checking the original recovery record…':message}</p>
 </section>;
}
