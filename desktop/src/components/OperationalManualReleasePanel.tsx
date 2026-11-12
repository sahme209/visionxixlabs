import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {ManualReleaseClient} from '../lib/manualRelease';
import {manualReleaseResult,manualReleaseId,manualReleaseHistory,manualReleaseReviewReceipt,type ManualReleaseHistory,type ManualReleaseResult} from '../../../lib/governance/platform/operations/manualReleaseClientContract';
interface Props{client:ManualReleaseClient;currentUserId:string;canApprove:boolean;canRecordNotice:boolean}
/** Prepared manual evidence UI. No provider/deployment client or owner identity
 * inference. Props guide presentation; the server checks actual authority. */
export function OperationalManualReleasePanel({client,currentUserId,canApprove,canRecordNotice}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,client,currentUserId}).current;
 const latest=useRef({client,currentUserId,canApprove,canRecordNotice});latest.current={client,currentUserId,canApprove,canRecordNotice};
 const alive=useRef(true),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null),original=useRef<ManualReleaseHistory|null>(null);
 const [reference,setReference]=useState(''),[saved,setSaved]=useState<ManualReleaseHistory|null>(null),[busy,setBusy]=useState(false),[checked,setChecked]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState('');
 const [deploymentId,setDeploymentId]=useState(''),[result,setResult]=useState<ManualReleaseResult|null>(null);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config&&owner.client===latest.current.client&&owner.currentUserId===latest.current.currentUserId;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const fresh=Boolean(saved&&!saved.expired&&Date.parse(saved.manifest.expiresAt)>Date.now()),review=Boolean(saved?.status==='proposed'&&currentUserId!==saved.requesterUserId),notice=Boolean(saved?.status==='reviewed'&&currentUserId===saved.requesterUserId);
 const eligible=fresh&&!held&&(review&&canApprove||notice&&canRecordNotice);
 async function run(kind:'load'|'review'|'notice'){
  if(!owns()||running.current)return;
  if(kind!=='load'&&(!saved||!checked||!eligible||attempted.current||kind==='review'&&(!review||!latest.current.canApprove)||kind==='notice'&&(!notice||!latest.current.canRecordNotice)||Date.parse(saved.manifest.expiresAt)<=Date.now()))return;
  const id=kind==='load'?reference:saved?.recordId;if(!manualReleaseId.safeParse(id).success){setMessage('Enter the original saved manual release reference.');return}
  const c=new AbortController();active.current=c;running.current=true;setBusy(true);setMessage('');setChecked(false);if(kind==='load'){setSaved(null);setResult(null)}else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='load'){
    const response=await client.inspect(id!,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const parsed=manualReleaseHistory.safeParse(response.data);if(!parsed.success||parsed.data.recordId!==id)throw Error('mismatch');
    const prior=original.current,next=parsed.data;if(prior?.recordId===next.recordId&&(prior.manifest.digest!==next.manifest.digest||prior.requesterUserId!==next.requesterUserId||prior.reviewerUserId&&prior.reviewerUserId!==next.reviewerUserId||next.version<prior.version))throw Error('lineage');original.current=next;setSaved(next);setMessage('Original release evidence loaded. Current source validation is checked again by the server when a decision is submitted.');
   }else if(saved&&kind==='review'){
    const response=await client.review(saved,c.signal);if(!owns())return;if(!response.ok||!manualReleaseReviewReceipt.safeParse(response.data).success)throw Error('unconfirmed');setMessage('Independent review recorded. Load original evidence to see the saved decision. Nothing deployed.');
   }else if(saved){
    const response=await client.recordNotice(saved,c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');const parsed=manualReleaseHistory.safeParse(response.data);if(!parsed.success||parsed.data.recordId!==saved.recordId||parsed.data.manifest.digest!==saved.manifest.digest||parsed.data.status!=='notice_recorded')throw Error('mismatch');original.current=parsed.data;setSaved(parsed.data);setMessage('Release handoff notice recorded. No deployment was performed or owner permission verified.');
   }
  }catch{if(owns())setMessage(kind==='load'?'Original evidence is unavailable or changed. No decision or notice was submitted.':'The recording outcome is unconfirmed. Inspect the original record; do not submit again automatically.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 async function readResult(){
  if(!owns()||running.current||!saved||!['notice_claimed','notice_recorded'].includes(saved.status))return;
  const c=new AbortController();active.current=c;running.current=true;setBusy(true);setResult(null);setMessage('');
  try{const response=await client.inspectResult(saved,deploymentId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const parsed=manualReleaseResult.safeParse(response.data);if(!parsed.success||parsed.data.recordId!==saved.recordId||parsed.data.deploymentId!==deploymentId)throw Error('mismatch');setResult(parsed.data);setMessage('Selected deployment evidence read. No deployment or rollback was started.');}
  catch{if(owns())setMessage('Deployment evidence is unavailable or changed. No deployment or rollback was submitted.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account context changed. Reopen the original manual release evidence.</p>;
 return <section aria-label="Manual production release evidence" className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-5" aria-busy={busy}>
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Production release · prepared locally</p><h2 className="mt-2 text-xl font-medium">Review the release, keep the owner in control</h2><p className="mt-2 text-sm text-zinc-400">The owner must click the production deployment in Vercel. This screen records evidence and a handoff notice only.</p></header>
  <div className="flex flex-wrap gap-3"><label>Manual release reference<input value={reference} disabled={busy} onChange={e=>{setReference(e.target.value);setSaved(null);setResult(null);setChecked(false)}}/></label><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Load original release evidence</button></div>
  {saved&&<>
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Project</dt><dd>{saved.manifest.target.projectId}</dd></div><div><dt>Team</dt><dd>{saved.manifest.target.teamId}</dd></div><div><dt>Commit on main</dt><dd className="break-all">{saved.manifest.source.commit}</dd></div><div><dt>Recorded state</dt><dd>{saved.status} · version {saved.version}</dd></div></dl>
   <p>No provider execution. Owner authorization remains externally unverified. This record does not prove a deployment occurred or became ready.</p>
   {!fresh&&<p role="alert">This review window expired. Original evidence does not grant new permission.</p>}
   {saved.status==='proposed'&&!review&&<p>Another authorized person must independently review your release.</p>}
   {(review||notice)&&<div className="space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy||!eligible} onChange={e=>setChecked(e.target.checked)}/>{review?'I reviewed this exact release, source and evidence references.':'I understand this records only a handoff notice and does not deploy.'}</label><button type="button" className="btn-primary" disabled={busy||!eligible||!checked} onClick={()=>void run(review?'review':'notice')}>{review?'Record independent release review':'Record release handoff notice'}</button></div>}
   {['notice_claimed','notice_recorded'].includes(saved.status)&&<section aria-label="Selected deployment result" className="space-y-3"><h3 className="font-medium">Inspect one deployment</h3><p>Read evidence for the exact deployment ID. No latest-deployment selection, automatic polling or retry.</p><label>Exact deployment ID<input value={deploymentId} disabled={busy} onChange={e=>{if(!running.current){setDeploymentId(e.target.value);setResult(null)}}}/></label><button type="button" className="btn-secondary" disabled={busy||!/^dpl_[A-Za-z0-9_]{1,128}$/.test(deploymentId)} onClick={()=>void readResult()}>Read selected deployment evidence</button>{result&&<dl><div><dt>Provider state</dt><dd>{result.providerState}</dd></div><div><dt>Evidence classification</dt><dd>{result.state}</dd></div><div><dt>Observed</dt><dd>{result.observedAt}</dd></div></dl>}</section>}
   <details><summary>Evidence references</summary><p className="break-all">Manifest: {saved.manifest.digest}</p><p>Artifact: {saved.manifest.artifactEvidenceId}</p><p>Schema compatibility: {saved.manifest.compatibilityEvidenceId}</p><p>Recovery: {saved.manifest.recoveryEvidenceId}</p><p>Expires: {saved.manifest.expiresAt}</p>{saved.manifest.ciEvidence.map(c=><p key={c.name}>{c.name}: {c.receiptId}</p>)}</details>
  </>}
  <p role="status" aria-live="polite">{busy?'Checking original release evidence…':message}</p>
 </section>;
}
