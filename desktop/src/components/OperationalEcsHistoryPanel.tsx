import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {OperationalHistoryClient} from '../lib/operationalReview';
import {ecsHistory,ecsNativeObservation,type EcsHistory,type EcsNativeObservation} from '../../../lib/governance/platform/operations/ecsHistoryContract';
interface Props{actionId:string;currentUserId:string;canObserve?:boolean;client:Pick<OperationalHistoryClient,'inspect'>&Partial<Pick<OperationalHistoryClient,'observe'>>}
/** Prepared history plus explicitly confirmed native observation. No deployment,
 * credential acquisition, rollback, automatic polling or automatic retry. */
export function OperationalEcsHistoryPanel({actionId,currentUserId,client,canObserve=false}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,apiBase:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,actionId,currentUserId,client}).current;
 const latest=useRef({actionId,currentUserId,client});latest.current={actionId,currentUserId,client};
 const alive=useRef(true),running=useRef(false),active=useRef<AbortController|null>(null);
 const [checked,setChecked]=useState(false),[held,setHeld]=useState(false),[observation,setObservation]=useState<EcsNativeObservation|null>(null);
 const [history,setHistory]=useState<EcsHistory|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&desktopClient.config.apiBase===owner.apiBase&&desktopClient.config.sessionToken===owner.token&&latest.current.actionId===owner.actionId&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 async function load(){
  if(!owns()||running.current)return;running.current=true;const c=new AbortController();active.current=c;setBusy(true);setHistory(null);setChecked(false);setObservation(null);setMessage('');
  try{const response=await client.inspect(actionId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const parsed=ecsHistory.safeParse(response.data);if(!parsed.success||parsed.data.actionId!==actionId)throw Error('mismatched');setHistory(parsed.data);try{setHeld(sessionStorage.getItem(marker(parsed.data))==='attempted')}catch{setHeld(true)}setMessage('Original history loaded. No action was submitted.')}
  catch{if(owns())setMessage('Original history is unavailable. Keep the saved reference; no action was submitted.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 function marker(value:EcsHistory){return 'axiom.ecs.observation:'+JSON.stringify([owner.apiBase,currentUserId,actionId,value.targetReservation?.generation,value.result?.receiptDigest])}
 const eligible=Boolean(history&&history.parentStatus==='claimed'&&history.effectStatus==='confirmed'&&history.result?.kind==='accepted'&&history.credential.status==='issued'&&history.targetReservation&&!history.stability&&!history.failure&&canObserve&&client.observe);
 async function observe(){
  if(!owns()||running.current||!eligible||!history||!checked||held||!client.observe)return;
  const saved=history,key=marker(saved);running.current=true;setHeld(true);setChecked(false);setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  try{
   sessionStorage.setItem(key,'attempted');const response=await client.observe(saved,c.signal);if(!owns()||c.signal.aborted)return;
   if(!response.ok)throw Error('unconfirmed');const p=ecsNativeObservation.safeParse(response.data);
   if(!p.success||p.data.actionId!==actionId||p.data.generation!==saved.targetReservation?.generation||p.data.credentialStatus!=='issued'||p.data.phase==='reserved'||!(p.data.deploymentId===saved.result?.deploymentId||p.data.phase==='unknown'&&p.data.deploymentId===null))throw Error('mismatched');
   setObservation(p.data);try{sessionStorage.setItem(key,'observed')}catch{/* Retain attempted hold if local receipt persistence fails. */}
   setMessage(p.data.parentReconciliation==='confirmed_from_native_receipt'?'Native stability observed and the original action confirmed. Load history to view its saved evidence.':p.data.phase==='terminal_failure'?'Native rollout failure observed. Rollback requires a separate exact review. Load original history.':p.data.phase==='accepted'?'Still accepted; stability is not confirmed. Load history before a separate deliberate status check.':p.data.phase==='unknown'?'Native status remains unknown. Keep the original action; no automatic retry.':'Native receipt observed. Load original history; this grants no new execution permission.');
  }catch{if(owns())setMessage('Observation is unconfirmed. Load the original history; do not repeat automatically. A lost reply may already have saved its observation.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the original history.</p>;
 return <section aria-label="Original ECS deployment history" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Original evidence · prepared locally</p><h2 className="mt-2 text-xl font-medium">What happened to this deployment?</h2><p className="mt-2 text-sm text-zinc-400">Read the saved attempt. Loading history never renews approval, issues credentials or sends a deployment.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void load()}>Load original deployment history</button>
  {history&&<>
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Recorded action</dt><dd>{history.parentStatus}</dd></div><div><dt>Execution credential record</dt><dd>{history.credential.status}</dd></div>{history.sourceCredential&&<div><dt>Custodian credential record</dt><dd>{history.sourceCredential.status} · retained independently of this deployment</dd></div>}<div><dt>Deployment target</dt><dd className="break-all">{history.manifest.target.serviceArn}</dd></div><div><dt>Workflow run</dt><dd>{history.manifest.workload.runId} · attempt {history.manifest.workload.attempt}</dd></div></dl>
   {history.expired&&<p>Historical window expired. This record grants no new permission.</p>}
   {history.result?.kind==='accepted'?<div><p>The provider accepted the original command. This command receipt does not prove deployment stability.</p><p className="break-all">Deployment reference: {history.result.deploymentId}</p></div>:history.result?.kind==='unknown'?<p role="alert">The original command outcome is unknown. Do not resend or create a replacement.</p>:<p>{history.effectStatus==='claimed'?'The original command is claimed; no final command result is recorded. Do not resend.':'No deployment command is recorded.'}</p>}
   {history.failure&&<div role="alert"><p>Native rollout failure was recorded for this original deployment.</p><p>This historical receipt does not authorize rollback, resend or a replacement. Current deployment health is not checked; any rollback requires a separate exact review and current source and credential checks.</p><dl><dt>Original failed deployment</dt><dd>{history.failure.deploymentId}</dd><dt>Failure observed</dt><dd>{history.failure.observedAt}</dd><dt>Original failure receipt</dt><dd className="break-all">{history.failure.receiptId}</dd></dl></div>}
   {history.stability?<div><p>Original native stability evidence is recorded. This historical proof does not check current deployment health.</p><dl><dt>Observed by</dt><dd>{history.stability.observerUserId}</dd><dt>Observed at</dt><dd>{history.stability.observedAt}</dd><dt>Original stability receipt</dt><dd className="break-all">{history.stability.receiptId}</dd></dl></div>:history.parentStatus==='confirmed'&&<p>The action was later recorded as confirmed. Fresh provider health and the separate native stability proof are not checked by this history reader.</p>}
   {eligible&&<fieldset className="space-y-3 border-t border-white/10 pt-4"><legend>Check this original deployment</legend><p className="text-sm text-zinc-400">One deliberate native status read may save evidence and confirm this original action. It sends no deployment, changes no service and authorizes no rollback. Real qualified sources are still required.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy||held} onChange={e=>setChecked(e.target.checked)}/>Read and record status for this exact original deployment.</label><button type="button" className="btn-secondary" disabled={busy||held||!checked} onClick={()=>void observe()}>Check original deployment status once</button>{held&&<p className="text-xs text-zinc-400">Inspect saved history before any further decision. An uncertain observation stays held; no automatic retry or polling.</p>}</fieldset>}
   {observation&&<p className="text-sm">Observed {observation.phase} · generation {observation.generation} · {observation.sourceValidation==='historical_terminal_receipt_only'?'historical terminal receipt, current health not checked':'qualified source checked for this observation'}. No new execution authority.</p>}
   <details><summary>Original references</summary><p className="break-all">{history.actionId}</p><p className="break-all">Manifest: {history.manifest.digest}</p>{history.result&&<p className="break-all">Command receipt: {history.result.receiptDigest}</p>}</details>
  </>}
  <p role="status" aria-live="polite">{busy?'Loading the original saved record…':message}</p>
 </section>;
}
