import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {OperationalHistoryClient} from '../lib/operationalReview';
import {ecsHistory,type EcsHistory} from '../../../lib/governance/platform/operations/ecsHistoryContract';
interface Props{actionId:string;currentUserId:string;client:OperationalHistoryClient}
/** Prepared original-record recovery only. No source requalification or action. */
export function OperationalEcsHistoryPanel({actionId,currentUserId,client}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,actionId,currentUserId,client}).current;
 const latest=useRef({actionId,currentUserId,client});latest.current={actionId,currentUserId,client};
 const alive=useRef(true),running=useRef(false),active=useRef<AbortController|null>(null);
 const [history,setHistory]=useState<EcsHistory|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&latest.current.actionId===owner.actionId&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 async function load(){
  if(!owns()||running.current)return;running.current=true;const c=new AbortController();active.current=c;setBusy(true);setHistory(null);setMessage('');
  try{const response=await client.inspect(actionId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const parsed=ecsHistory.safeParse(response.data);if(!parsed.success||parsed.data.actionId!==actionId)throw Error('mismatched');setHistory(parsed.data);setMessage('Original history loaded. No action was submitted.')}
  catch{if(owns())setMessage('Original history is unavailable. Keep the saved reference; no action was submitted.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the original history.</p>;
 return <section aria-label="Original ECS deployment history" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Original evidence · prepared locally</p><h2 className="mt-2 text-xl font-medium">What happened to this deployment?</h2><p className="mt-2 text-sm text-zinc-400">Read the saved attempt. Loading history never renews approval, issues credentials or sends a deployment.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void load()}>Load original deployment history</button>
  {history&&<>
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Recorded action</dt><dd>{history.parentStatus}</dd></div><div><dt>Credential record</dt><dd>{history.credential.status}</dd></div><div><dt>Deployment target</dt><dd className="break-all">{history.manifest.target.serviceArn}</dd></div><div><dt>Workflow run</dt><dd>{history.manifest.workload.runId} · attempt {history.manifest.workload.attempt}</dd></div></dl>
   {history.expired&&<p>Historical window expired. This record grants no new permission.</p>}
   {history.result?.kind==='accepted'?<div><p>The provider accepted the original command. This command receipt does not prove deployment stability.</p><p className="break-all">Deployment reference: {history.result.deploymentId}</p></div>:history.result?.kind==='unknown'?<p role="alert">The original command outcome is unknown. Do not resend or create a replacement.</p>:<p>{history.effectStatus==='claimed'?'The original command is claimed; no final command result is recorded. Do not resend.':'No deployment command is recorded.'}</p>}
   {history.stability?<div><p>Original native stability evidence is recorded. This historical proof does not check current deployment health.</p><dl><dt>Observed by</dt><dd>{history.stability.observerUserId}</dd><dt>Observed at</dt><dd>{history.stability.observedAt}</dd><dt>Original stability receipt</dt><dd className="break-all">{history.stability.receiptId}</dd></dl></div>:history.parentStatus==='confirmed'&&<p>The action was later recorded as confirmed. Fresh provider health and the separate native stability proof are not checked by this history reader.</p>}
   <details><summary>Original references</summary><p className="break-all">{history.actionId}</p><p className="break-all">Manifest: {history.manifest.digest}</p>{history.result&&<p className="break-all">Command receipt: {history.result.receiptDigest}</p>}</details>
  </>}
  <p role="status" aria-live="polite">{busy?'Loading the original saved record…':message}</p>
 </section>;
}
