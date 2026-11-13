import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {CustodianClient} from '../lib/custodian';
import {custodianPreview,custodianReviewReceipt,custodianExecutionReceipt,type CustodianPreview} from '../../../lib/governance/platform/operations/custodianClientContract';
interface Props{actionId:string;currentUserId:string;canApprove:boolean;canExecute:boolean;client:CustodianClient}
/** Prepared exact-control decisions only. Human capability props never grant
 * server authority; review and requester control execution remain separate. */
export function CustodianControlPanel({actionId,currentUserId,canApprove,canExecute,client}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,apiBase:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,actionId,currentUserId,client}).current;
 const latest=useRef({actionId,currentUserId,client,canApprove,canExecute});latest.current={actionId,currentUserId,client,canApprove,canExecute};
 const alive=useRef(true),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [preview,setPreview]=useState<CustodianPreview|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState('');
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&desktopClient.config.apiBase===owner.apiBase&&desktopClient.config.sessionToken===owner.token&&latest.current.actionId===owner.actionId&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const requester=preview?.requesterUserId===currentUserId,expired=Boolean(preview&&Date.parse(preview.control.expiresAt)<=Date.now());
 const reviewable=Boolean(preview?.status==='proposed'&&!requester&&canApprove&&!expired&&!held),executable=Boolean(preview?.status==='approved'&&requester&&canExecute&&!expired&&!held);
 async function run(kind:'load'|'review'|'execute'){
  if(!owns()||running.current||kind!=='load'&&(!checked||attempted.current||!preview||Date.parse(preview.control.expiresAt)<=Date.now()||kind==='review'&&(!reviewable||!latest.current.canApprove)||kind==='execute'&&(!executable||!latest.current.canExecute)))return;
  running.current=true;const c=new AbortController();active.current=c;setBusy(true);setChecked(false);setMessage('');if(kind==='load')setPreview(null);else{attempted.current=true;setHeld(true)}
  try{
   if(kind==='load'){
    const response=await client.preview(actionId,c.signal);if(!owns())return;if(!response.ok)throw Error('unavailable');const p=custodianPreview.safeParse(response.data);if(!p.success||p.data.actionId!==actionId)throw Error('mismatch');setPreview(p.data);setMessage('Exact control loaded. This preview is not credential-closure proof.');
   }else if(preview){
    if(kind==='review'){
     const response=await client.review(preview,c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');const r=custodianReviewReceipt.safeParse(response.data);if(!r.success||r.data.actionId!==actionId||r.data.planDigest!==preview.planDigest)throw Error('mismatch');setMessage('Approval recorded. The original requester must apply the control separately. No credentials or provider operation were issued.');
    }else{
     const response=await client.executeControl(preview,c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');const r=custodianExecutionReceipt.safeParse(response.data);if(!r.success||r.data.actionId!==actionId||r.data.barrier.controlDigest!==preview.control.digest||r.data.barrier.nativeKey!==preview.control.nativeKey)throw Error('mismatch');setMessage('Control recorded. Inspect original history; credential closure and provider outcomes remain separate.');
    }
   }
  }catch{if(owns())setMessage(kind==='load'?'Current control preview is unavailable. Inspect the original history; no decision was submitted.':'The control decision or execution result is unconfirmed. Inspect the same original action; do not repeat automatically.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(revision!==owner.revision||!owns())return <p role="status">Account or action changed. Reopen the exact saved control.</p>;
 const control=preview?.control;
 return <section aria-label="Exact issuer control" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-5">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Issuer controls · prepared locally</p><h2 className="mt-2 text-xl font-medium">Review one exact issuer control</h2><p className="mt-2 text-sm text-zinc-400">A drain stops new issuance at this boundary. It does not revoke credentials already issued, stop provider work or prove safe closure. An abort requires its own exact review and current closure checks.</p></header>
  <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('load')}>Load exact control preview</button>
  {preview&&control&&<>
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Requested control</dt><dd>{control.operation==='begin'?'Begin issuance drain':'Abort drain and restore reviewed admission'}</dd></div><div><dt>AWS account</dt><dd>{control.custodian.accountId}</dd></div><div><dt>Custodian role</dt><dd className="break-all">{control.custodian.roleArn}</dd></div><div><dt>Expected generation</dt><dd>{control.expectedGeneration}</dd></div><div><dt>Review expires</dt><dd>{control.expiresAt}</dd></div><div><dt>Recorded decision</dt><dd>{preview.status}</dd></div></dl>
   <details><summary>Exact control references</summary><p className="break-all">{actionId}</p><p className="break-all">Control: {control.digest}</p><p className="break-all">Plan: {preview.planDigest}</p><p className="break-all">Issuer profile: {control.issuerProfileDigest}</p><p className="break-all">Source evidence: {control.sourceEvidenceDigest}</p><p>Expected barrier version: {control.expectedVersion??'No previous barrier'}</p></details>
   {expired&&<p role="alert">The review window expired. History does not renew permission.</p>}
   {preview.status==='proposed'&&requester&&<p>Another authorized person must make the independent decision.</p>}
   {preview.status==='approved'&&!requester&&<p>The original requester must apply this control in the original authorized session.</p>}
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy||!reviewable&&!executable} onChange={e=>setChecked(e.target.checked)}/>{preview.status==='proposed'?'I personally reviewed this exact role, control and source.':'I authorize applying only this exact independently approved control.'}</label>
   {preview.status==='proposed'?<button type="button" className="btn-primary" disabled={busy||!reviewable||!checked} onClick={()=>void run('review')}>Record independent control approval</button>:<button type="button" className="btn-primary" disabled={busy||!executable||!checked} onClick={()=>void run('execute')}>Apply this one control</button>}
  </>}
  <p role="status" aria-live="polite">{busy?'Checking the exact saved control…':message}</p>
 </section>;
}
