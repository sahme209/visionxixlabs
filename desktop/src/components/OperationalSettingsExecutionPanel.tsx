import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {SettingsExecutionClient,SettingsHistoryClient} from '../lib/settingsReview';
import type {PlatformInspection} from '../../../lib/governance/platform/viewContract';
import {settingsHistory,type SettingsHistory} from '../../../lib/governance/platform/operations/settingsReviewContract';
import {settingsClaimReceipt,settingsExecutionReceipt} from '../../../lib/governance/platform/operations/settingsExecutionContract';
import {settingsNativeProfile} from '../../../lib/governance/platform/operations/settingsNativeProfile';
interface Props{action:PlatformInspection;currentUserId:string;canExecute:boolean;reader:SettingsHistoryClient;client:SettingsExecutionClient;onRecorded?:()=>void}
/** Prepared requester control: claim and each exact write remain separate.
 * No automatic next-child, recovery retry or provider/source qualification. */
export function OperationalSettingsExecutionPanel({action,currentUserId,canExecute,reader,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,action,currentUserId,reader,client}).current;
 const latest=useRef({action,currentUserId,canExecute,reader,client});latest.current={action,currentUserId,canExecute,reader,client};
 const alive=useRef(true),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [history,setHistory]=useState<SettingsHistory|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[known,setKnown]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&latest.current.action===owner.action&&latest.current.currentUserId===owner.currentUserId&&latest.current.reader===owner.reader&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const isClaim=action.status==='approved',nextIndex=action.effects.findIndex(e=>e.status==='not_started'),manifest=history?.manifest;
 const expired=action.expired||Date.parse(action.plan.expiresAt)<=Date.now(),requester=currentUserId===action.requesterUserId;
 const eligible=canExecute&&requester&&!history?.expired&&!expired&&!held&&!known&&Boolean(manifest)&&['approved','claimed'].includes(action.status)&&nextIndex>=0;
 function matches(h:SettingsHistory){
  if(h.actionId!==action.actionId||h.planDigest!==action.plan.digest||h.status!==action.status||h.version!==action.version||h.attemptCount!==action.attemptCount||h.requesterUserId!==action.requesterUserId||h.reviewerUserId!==action.reviewerUserId||!h.manifest||h.manifest.digest!==action.plan.sourceDigest||h.manifest.settings.length!==action.effects.length||h.manifest.settings.some(s=>s.current.kind!=='absent'))return false;
  return action.effects.every((effect,index)=>{const result=h.results.find(r=>r.effectIndex===index);return effect.status==='not_started'?!result:effect.status==='confirmed'&&result?.outcome==='confirmed'});
 }
 async function run(kind:'load'|'continue'){
  if(!owns()||running.current||kind==='continue'&&(!eligible||!checked||attempted.current||!latest.current.canExecute||!history||!matches(history)||Date.parse(action.plan.expiresAt)<=Date.now()))return;
  running.current=true;const c=new AbortController();active.current=c;setBusy(true);setMessage('');setChecked(false);if(kind==='load')setHistory(null);else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='load'){const response=await reader.inspect(action.actionId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const p=settingsHistory.safeParse(response.data);if(!p.success||!matches(p.data))throw Error('changed');setHistory(p.data);setMessage('Original targets loaded. Current authority and source will be checked again by the server before any change.')}
   else{const response=isClaim?await client.claim(action,c.signal):await client.execute(action,nextIndex,c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');if(isClaim){const p=settingsClaimReceipt.safeParse(response.data);if(!p.success||p.data.actionId!==action.actionId||p.data.planDigest!==action.plan.digest)throw Error('mismatched')}else{const p=settingsExecutionReceipt.safeParse(response.data);if(!p.success||p.data.actionId!==action.actionId||p.data.effectIndex!==nextIndex)throw Error('mismatched')}setKnown(true);setMessage(isClaim?'Claim recorded. Reload original history before selecting a separate setting command. No setting was sent.':'This exact setting was confirmed. Reload original history before choosing any later setting. No deployment was started.');try{onRecorded?.()}catch{setMessage(isClaim?'Claim recorded. The surrounding history refresh failed; inspect the original action.':'The exact setting was confirmed. The surrounding history refresh failed; inspect the original action.')}}
  }catch{if(owns())setMessage(kind==='load'?'Exact original targets are unavailable or the saved state changed. Reload the original action; nothing was submitted.':'The claim or setting result is unconfirmed. Inspect the original action; do not resend or advance automatically.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or saved action changed. Reopen the original requester step.</p>;
 return <section aria-label="Exact requester settings step" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-5">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Requester confirmation · prepared locally</p><h2 className="mt-2 text-xl font-medium">{isClaim?'Claim the approved settings action':'Send one exact setting'}</h2><p className="mt-2 text-sm text-zinc-400">Each step is separate. Current server permissions, source, custody and provider qualification remain required. Nothing advances automatically or deploys the application.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Inspect exact settings before continuing</button>
  {manifest&&<><p>Project: {manifest.target.projectId} · Team: {manifest.target.teamId}</p><ol className="space-y-3">{manifest.settings.map((setting,index)=><li key={setting.artifactId} className="rounded-lg border border-white/10 p-3"><h3 className="font-medium">{setting.name}</h3><p>{setting.environment} · {settingsNativeProfile({type:setting.type,sensitivity:setting.sensitivity}).visibility} · {action.effects[index].status}</p>{!isClaim&&index===nextIndex&&<p>This is the only next setting selected for sending.</p>}</li>)}</ol>
   {!requester&&<p>Only the original requester in the original authorized session may continue.</p>}{expired&&<p role="alert">The action window expired. Historical approval grants no new execution permission.</p>}
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy} onChange={e=>setChecked(e.target.checked)}/>{isClaim?'Claim only this exact independently approved action; do not send a setting yet.':'Send only the selected exact next setting once.'}</label>
   <button type="button" className="btn-primary" disabled={!eligible||!checked||busy} onClick={()=>void run('continue')}>{isClaim?'Claim this approved settings action':'Send only this exact setting'}</button>
  </>}
  <p role="status" aria-live="polite">{busy?'Checking the exact requester step…':message}</p>
 </section>;
}
