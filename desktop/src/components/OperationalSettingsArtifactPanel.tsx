import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {SettingsReviewClient,SettingsArtifactClient} from '../lib/settingsReview';
import {settingsReviewPreview,type SettingsReviewPreview} from '../../../lib/governance/platform/operations/settingsReviewContract';
import {settingsArtifactReceipt} from '../../../lib/governance/platform/operations/settingsArtifactClientContract';
interface Props{actionId:string;planDigest:string;requesterUserId:string;currentUserId:string;canPrepare:boolean;reader:Pick<SettingsReviewClient,'preview'>;client:SettingsArtifactClient}
/** Prepared requester-only entry. No persistence, review, claim or provider write.
 * Entered text is visible to its requester and cleared on submission/context loss.
 * JavaScript cannot promise physical memory zeroization. */
export function OperationalSettingsArtifactPanel({actionId,planDigest,requesterUserId,currentUserId,canPrepare,reader,client}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,actionId,planDigest,requesterUserId,currentUserId,reader,client}).current;
 const latest=useRef({actionId,planDigest,requesterUserId,currentUserId,canPrepare,reader,client});latest.current={actionId,planDigest,requesterUserId,currentUserId,canPrepare,reader,client};
 const alive=useRef(true),running=useRef(false),attempted=useRef(new Set<number>()),active=useRef<AbortController|null>(null);
 const [preview,setPreview]=useState<SettingsReviewPreview|null>(null),[index,setIndex]=useState(0),[value,setValue]=useState(''),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&latest.current.actionId===owner.actionId&&latest.current.planDigest===owner.planDigest&&latest.current.requesterUserId===owner.requesterUserId&&latest.current.currentUserId===owner.currentUserId&&latest.current.reader===owner.reader&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 useEffect(()=>{if(!owns()){setValue('');setPreview(null);setChecked(false)}},[revision,actionId,planDigest,requesterUserId,currentUserId,reader,client]);
 const requester=currentUserId===requesterUserId,setting=preview?.settings[index],eligible=requester&&canPrepare&&setting?.artifactStatus==='missing'&&!attempted.current.has(index)&&!held&&Boolean(preview&&Date.parse(preview.expiresAt)>Date.now());
 async function run(kind:'load'|'save'){
  if(!owns()||running.current||kind==='save'&&(!eligible||!checked||!latest.current.canPrepare||!preview))return;
  const c=new AbortController();active.current=c;running.current=true;setBusy(true);setMessage('');setChecked(false);const submitted=kind==='save'?value:'';setValue('');if(kind==='load')setPreview(null);else attempted.current.add(index);
  try{
   if(kind==='load'){const response=await reader.preview(actionId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const p=settingsReviewPreview.safeParse(response.data);if(!p.success||p.data.actionId!==actionId||p.data.planDigest!==planDigest)throw Error('mismatched');setPreview(p.data);setIndex(p.data.settings.findIndex(s=>s.artifactStatus==='missing')<0?0:p.data.settings.findIndex(s=>s.artifactStatus==='missing'));setMessage('Exact artifact targets loaded. No value was read back.')}
   else if(preview&&setting){const response=await client.save(preview,index,submitted,c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');const p=settingsArtifactReceipt.safeParse(response.data);if(!p.success||p.data.actionId!==actionId||p.data.artifactId!==setting.artifactId||p.data.effectIndex!==index||p.data.creatorUserId!==currentUserId||p.data.profileId!==preview.profileId||p.data.target.projectId!==preview.target.projectId||p.data.target.teamId!==preview.target.teamId||p.data.target.name!==setting.name||p.data.target.environment!==setting.environment||p.data.target.type!==setting.type||p.data.target.sensitivity!==setting.sensitivity||p.data.expiresAt!==preview.expiresAt)throw Error('mismatched');setPreview(null);setMessage('Protected artifact saved. Reload metadata to inspect readiness; no setting was written and no approval recorded.')}
  }catch{if(owns()){if(kind==='save')setHeld(true);setMessage(kind==='load'?'Exact artifact metadata is unavailable. No value was submitted.':'Artifact saving is unconfirmed. Inspect the original metadata; do not submit the value again.')}}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the original artifact step.</p>;
 return <section aria-label="Protected settings artifact entry" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Requester preparation · local only</p><h2 className="mt-2 text-xl font-medium">Prepare the protected values</h2><p className="mt-2 text-sm text-zinc-400">Save each exact artifact before independent review. This does not change provider settings. Real custody qualification and customer activation remain unavailable.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Load exact artifact targets</button>
  {preview&&<><p>Project: {preview.target.projectId} · Team: {preview.target.teamId}</p><ul>{preview.settings.map(s=><li key={s.artifactId}>{s.name} · {s.environment} · {s.artifactStatus}</li>)}</ul>
   {!requester?<p>Only the original requester in the original authorized session may submit protected values.</p>:<div className="space-y-3">
    <label>Exact artifact target<select value={index} disabled={busy||held} onChange={e=>{setIndex(Number(e.target.value));setValue('');setChecked(false)}}>{preview.settings.map((s,i)=><option key={s.artifactId} value={i}>{s.name} · {s.environment} · {s.artifactStatus}</option>)}</select></label>
    <label>Protected value<textarea value={value} disabled={!eligible||busy} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} maxLength={65536} onChange={e=>setValue(e.target.value)}/></label>
    <p className="text-sm text-zinc-400">Text is visible while you enter it and clears when submission begins. It is never included in review or history metadata.</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy} onChange={e=>setChecked(e.target.checked)}/>Save this value only for the selected exact artifact target.</label>
    <button type="button" className="btn-primary" disabled={!eligible||!checked||busy} onClick={()=>void run('save')}>Save this protected artifact once</button>
    {preview.reviewReady&&<p>All artifacts are recorded. Another authorized person must review the exact proposal separately.</p>}
   </div>}
  </>}
  <p role="status" aria-live="polite">{busy?'Checking the original artifact step…':message}</p>
 </section>;
}
