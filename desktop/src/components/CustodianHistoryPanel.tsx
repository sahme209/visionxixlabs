import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {CustodianClient} from '../lib/custodian';
import {custodianHistory,custodianObservationReceipt,type CustodianHistory} from '../../../lib/governance/platform/operations/custodianClientContract';
interface Props{actionId:string;currentUserId:string;client:CustodianClient;canObserve:boolean}
/** Historical metadata is not current credential/source qualification. */
export function CustodianHistoryPanel({actionId,currentUserId,client,canObserve}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,apiBase:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,actionId,currentUserId,client}).current;
 const latest=useRef({actionId,currentUserId,client,canObserve});latest.current={actionId,currentUserId,client,canObserve};
 const alive=useRef(true),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [history,setHistory]=useState<CustodianHistory|null>(null),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&desktopClient.config.apiBase===owner.apiBase&&desktopClient.config.sessionToken===owner.token&&latest.current.actionId===owner.actionId&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const eligible=canObserve&&history?.status==='confirmed'&&history.control.operation==='begin'&&!held;
 async function run(kind:'load'|'observe'|'refresh',afterSequence?:number){
  if(!owns()||running.current||kind!=='load'&&(!eligible||!latest.current.canObserve||attempted.current||!history))return;
  running.current=true;const c=new AbortController();active.current=c;setBusy(true);setMessage('');const prior=history;if(kind==='load')setHistory(null);else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='load'){
    const response=await client.inspect(actionId,c.signal,afterSequence);if(!owns())return;if(!response.ok)throw Error('unavailable');const parsed=custodianHistory.safeParse(response.data);if(!parsed.success||parsed.data.actionId!==actionId||parsed.data.closurePage.afterSequence!==(afterSequence??-1)||afterSequence!==undefined&&(!prior||parsed.data.planDigest!==prior.planDigest))throw Error('mismatch');setHistory(parsed.data);setMessage('Original history loaded. No decision or observation was submitted.');
   }else if(history){
    const response=await client.observeClosure(history,kind==='refresh',c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');const parsed=custodianObservationReceipt.safeParse(response.data);if(!parsed.success||parsed.data.observation.controlActionId!==actionId||parsed.data.observation.controlDigest!==history.control.digest||parsed.data.observation.nativeKey!==history.control.nativeKey)throw Error('mismatch');setMessage('Closure observation recorded. Load original history to inspect it. Provider outcomes and permission to resume remain separate.');
   }
  }catch{if(owns())setMessage(kind==='load'?'Original history is unavailable. Keep the same saved reference.':'Closure observation is unconfirmed. Inspect original history before another deliberate observation; no automatic retry.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen original control history.</p>;
 return <section aria-label="Original issuer control history" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Original evidence · prepared locally</p><h2 className="mt-2 text-xl font-medium">What happened to this issuer control?</h2><p className="mt-2 text-sm text-zinc-400">A confirmed drain is not proof that existing credentials are closed. Historical observations do not reconcile provider outcomes or authorize resuming issuance.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Load original control history</button>
  {history&&<>
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Recorded control</dt><dd>{history.control.operation==='begin'?'Begin issuance drain':'Abort issuance drain'}</dd></div><div><dt>Recorded result</dt><dd>{history.status} · {history.attemptCount} attempt</dd></div><div><dt>Custodian role</dt><dd className="break-all">{history.control.custodian.roleArn}</dd></div><div><dt>Requester / reviewer</dt><dd>{history.requesterUserId} / {history.reviewerUserId??'Not recorded'}</dd></div></dl>
   {history.expired&&<p>The original review window expired. Reading history does not renew it.</p>}
   {['claimed','unknown'].includes(history.status)&&<p role="alert">The original control attempt is consumed or unknown. Do not replay it or create a replacement.</p>}
   <h3 className="font-medium">Recorded credential-closure observations</h3>
   <p>{history.closurePage.afterSequence===-1?'Showing the first page of recorded observations.':`Showing observations after event ${history.closurePage.afterSequence}. Earlier pages are not shown here.`} Each page is a current historical read, not a complete snapshot or current safety proof.</p>
   {!history.closures.length?<p>No closure observation is recorded. This does not establish safe credentials.</p>:<ul className="space-y-3">{history.closures.map(item=><li key={item.id}><p>Generation {item.generation} · {item.recordedIntentCount} recorded intents · observed by {item.observerUserId}</p><p>Observed {new Date(item.observedAt).toISOString()} · evidence expires {new Date(item.evidenceExpiresAt).toISOString()}</p><details><summary>Observation references</summary><p className="break-all">{item.id}</p><p className="break-all">Snapshot: {item.snapshotDigest}</p></details><p>Historical summary; current source and expiry safety are not checked by this view.</p></li>)}</ul>}
   {history.closurePage.nextSequence!==null&&<button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load',history.closurePage.nextSequence!)}>Load next closure page</button>}
   {history.status==='confirmed'&&history.control.operation==='begin'&&<div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" disabled={busy||!eligible} onClick={()=>void run('observe')}>Observe credential closure once</button>{history.closures.length>0&&<button type="button" className="btn-secondary" disabled={busy||!eligible} onClick={()=>void run('refresh')}>Refresh closure evidence once</button>}</div>}
   <details><summary>Original control references</summary><p className="break-all">{history.actionId}</p><p className="break-all">Control: {history.control.digest}</p><p className="break-all">Plan: {history.planDigest}</p></details>
  </>}
  <p role="status" aria-live="polite">{busy?'Reading the original control…':message}</p>
 </section>;
}
