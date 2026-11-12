import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {SettingsHistoryClient} from '../lib/settingsReview';
import {settingsHistory,type SettingsHistory} from '../../../lib/governance/platform/operations/settingsReviewContract';
function observedTime(value:number){const date=new Date(value);return Number.isNaN(date.getTime())?'Recorded time is unavailable':date.toISOString()}
interface Props{actionId:string;planDigest:string;currentUserId:string;client:SettingsHistoryClient}
/** Original nonsecret receipts only; no fresh source or provider read. */
export function OperationalSettingsHistoryPanel({actionId,planDigest,currentUserId,client}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,actionId,planDigest,currentUserId,client}).current;
 const latest=useRef({actionId,planDigest,currentUserId,client});latest.current={actionId,planDigest,currentUserId,client};
 const alive=useRef(true),running=useRef(false),active=useRef<AbortController|null>(null);
 const [history,setHistory]=useState<SettingsHistory|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&latest.current.actionId===owner.actionId&&latest.current.planDigest===owner.planDigest&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 async function load(){
  if(!owns()||running.current)return;running.current=true;const c=new AbortController();active.current=c;setBusy(true);setHistory(null);setMessage('');
  try{const response=await client.inspect(actionId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const p=settingsHistory.safeParse(response.data);if(!p.success||p.data.actionId!==actionId||p.data.planDigest!==planDigest)throw Error('mismatched');setHistory(p.data);setMessage('Original settings history loaded. No action was submitted.')}
  catch{if(owns())setMessage('Original settings history is unavailable. Keep the saved action reference; no change was submitted.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the original settings history.</p>;
 return <section aria-label="Original settings history" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Original evidence · prepared locally</p><h2 className="mt-2 text-xl font-medium">What happened to these settings?</h2><p className="mt-2 text-sm text-zinc-400">Read saved results without exposing values, renewing permission or checking current provider settings.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void load()}>Load original settings history</button>
  {history&&<><p>Recorded action: {history.status}</p>{history.expired&&<p>The historical window expired. This record grants no new permission.</p>}
   {history.results.length?<ol className="space-y-3">{history.results.map(result=><li key={result.effectIndex} className="rounded-lg border border-white/10 p-3"><h3 className="font-medium">Original setting operation {result.effectIndex+1}</h3><p>Recorded outcome: {result.outcome}</p>{result.outcome==='unknown'&&<p role="alert">The result is unknown. Do not resend or create a replacement.</p>}{result.settingId&&<p className="break-all">Provider setting reference: {result.settingId}</p>}<p>Observed: {observedTime(result.observedAt)}</p><details><summary>Original receipt reference</summary><p className="break-all">{result.receiptDigest}</p></details></li>)}</ol>:<p>No final setting results are recorded. Absence of a result does not establish that a write was safe to repeat.</p>}
   <details><summary>Original action references</summary><p className="break-all">{actionId}</p><p className="break-all">Plan: {planDigest}</p></details>
  </>}
  <p role="status" aria-live="polite">{busy?'Loading the original saved results…':message}</p>
 </section>;
}
