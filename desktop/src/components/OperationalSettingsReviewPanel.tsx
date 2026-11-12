import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {SettingsReviewClient} from '../lib/settingsReview';
import {settingsReviewPreview,settingsReviewDecision,type SettingsReviewPreview,type SettingsReviewDecision} from '../../../lib/governance/platform/operations/settingsReviewContract';
interface Props{actionId:string;planDigest:string;requesterUserId:string;currentUserId:string;canApprove:boolean;client:SettingsReviewClient;onRecorded?:(decision:SettingsReviewDecision)=>void}
/** Metadata-only independent decision; no secret input, claim or execution. */
export function OperationalSettingsReviewPanel({actionId,planDigest,requesterUserId,currentUserId,canApprove,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,actionId,planDigest,requesterUserId,currentUserId,client}).current;
 const latest=useRef({actionId,planDigest,requesterUserId,currentUserId,canApprove,client});latest.current={actionId,planDigest,requesterUserId,currentUserId,canApprove,client};
 const alive=useRef(true),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [preview,setPreview]=useState<SettingsReviewPreview|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[recorded,setRecorded]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&latest.current.actionId===owner.actionId&&latest.current.planDigest===owner.planDigest&&latest.current.requesterUserId===owner.requesterUserId&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const independent=currentUserId!==requesterUserId,expired=Boolean(preview&&Date.parse(preview.expiresAt)<=Date.now()),eligible=canApprove&&independent&&preview?.reviewReady&&!expired&&!held&&!recorded;
 async function run(kind:'load'|'review'){
  if(!owns()||running.current||kind==='review'&&(!eligible||!checked||attempted.current||!latest.current.canApprove||!preview||Date.parse(preview.expiresAt)<=Date.now()))return;
  running.current=true;const c=new AbortController();active.current=c;setBusy(true);setMessage('');setChecked(false);if(kind==='load')setPreview(null);else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='load'){const response=await client.preview(actionId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const p=settingsReviewPreview.safeParse(response.data);if(!p.success||p.data.actionId!==actionId||p.data.planDigest!==planDigest)throw Error('mismatched');setPreview(p.data);setMessage('Exact settings metadata loaded. Secret values are never displayed here.')}
   else if(preview){const response=await client.review(preview,c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');const decision=settingsReviewDecision.safeParse(response.data);if(!decision.success||decision.data.actionId!==actionId||decision.data.planDigest!==planDigest)throw Error('mismatched');setRecorded(true);setMessage('Independent settings approval recorded. No setting was written or deployment started.');try{onRecorded?.(decision.data)}catch{setMessage('Approval recorded. Reload original history to refresh the surrounding view.')}}
  }catch{if(owns())setMessage(kind==='load'?'Exact settings metadata is unavailable or changed. Approval remains unavailable.':'Approval outcome is unconfirmed. Inspect the original record; do not submit again automatically.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the original settings review.</p>;
 return <section aria-label="Exact settings review" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-5">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Platform settings · prepared locally</p><h2 className="mt-2 text-xl font-medium">Review the exact settings to create</h2><p className="mt-2 text-sm text-zinc-400">Check each name, environment and protected-artifact status. Approval records only your decision. Existing-setting updates remain unavailable.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Load exact settings proposal</button>
  {preview&&<>
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Project</dt><dd>{preview.target.projectId}</dd></div><div><dt>Team</dt><dd>{preview.target.teamId}</dd></div></dl>
   <ul className="space-y-3">{preview.settings.map(setting=><li key={setting.environment+':'+setting.name} className="rounded-lg border border-white/10 p-3"><h3 className="font-medium break-all">{setting.name}</h3><p>{setting.environment} · {setting.type} · {setting.sensitivity}</p><p>Current setting: absent · protected artifact: {setting.artifactStatus}</p></li>)}</ul>
   {!preview.reviewReady&&<p role="alert">A protected artifact is missing. Approval is unavailable until all exact artifacts are saved.</p>}
   {expired&&<p role="alert">The review window expired. Historical metadata grants no new permission.</p>}
   {!independent&&<p>Another authorized person must independently review your proposal.</p>}
   {recorded?<p>Independent decision recorded. The original requester continues separately; no setting changes here.</p>:<div className="space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy} onChange={e=>setChecked(e.target.checked)}/>I reviewed these exact setting targets and protected-artifact references.</label><button type="button" className="btn-primary" disabled={!eligible||!checked||busy} onClick={()=>void run('review')}>Record independent settings approval</button></div>}
   <details><summary>Original review references</summary><p className="break-all">{actionId}</p><p className="break-all">Plan: {planDigest}</p><p>Profile: {preview.profileId}</p><p>Expires: {preview.expiresAt}</p>{preview.settings.map(s=><p key={s.artifactId} className="break-all">{s.name}: {s.artifactId}</p>)}</details>
  </>}
  <p role="status" aria-live="polite">{busy?'Checking the exact saved proposal…':message}</p>
 </section>;
}
