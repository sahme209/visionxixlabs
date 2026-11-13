import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {z} from 'zod';
import {desktopClient} from '../lib/desktopClient';
import type {ImageWorkflowClient} from '../lib/imageWorkflow';
import {imageWorkflowPreview,imageWorkflowHistory} from '../../../lib/governance/platform/imageWorkflowContract';
type Preview=z.infer<typeof imageWorkflowPreview>;type History=z.infer<typeof imageWorkflowHistory>;
interface Props{actionId:string;expectedPlanDigest:string;currentUserId:string;canApprove:boolean;client:ImageWorkflowClient;onRecorded?:()=>void}
/** Prepared controls, not mounted. Only a deliberate validated client response
 * can create a transient Blob URL. UI permissions never replace the server. */
export function ImageWorkflowPanel({actionId,expectedPlanDigest,currentUserId,canApprove,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 const owner=useRef({revision,config:desktopClient.config,base:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,actionId,expectedPlanDigest,currentUserId,client}).current;
 const latest=useRef({actionId,expectedPlanDigest,currentUserId,canApprove,client});latest.current={actionId,expectedPlanDigest,currentUserId,canApprove,client};
 const alive=useRef(true),invalid=useRef(false),running=useRef(false),active=useRef<AbortController|null>(null),url=useRef<string|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null),[history,setHistory]=useState<History|null>(null),[imageUrl,setImageUrl]=useState<string|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function owns(){const v=latest.current,same=revision===owner.revision&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&desktopClient.config.apiBase===owner.base&&desktopClient.config.sessionToken===owner.token&&v.actionId===owner.actionId&&v.expectedPlanDigest===owner.expectedPlanDigest&&v.currentUserId===owner.currentUserId&&v.client===owner.client;if(!same)invalid.current=true;return alive.current&&!invalid.current&&same}
 function revoke(){if(url.current){URL.revokeObjectURL(url.current);url.current=null}}
 function clear(){revoke();setImageUrl(null);setPreview(null);setChecked(false)}
 const marker='axiom:image-review-attempt:'+currentUserId+':'+actionId+':'+expectedPlanDigest;
 function held(){try{return sessionStorage.getItem(marker)!==null}catch{return true}}
 function remember(){try{sessionStorage.setItem(marker,'attempted');return sessionStorage.getItem(marker)==='attempted'}catch{return false}}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort();revoke()}},[]);
 useEffect(()=>{if(!owns()){active.current?.abort();clear()}},[revision,actionId,expectedPlanDigest,currentUserId,client,desktopClient.config.sessionToken]);
 useEffect(()=>{if(!preview)return;const timer=setTimeout(()=>{clear();setMessage('The image review expired. History does not renew it.')},Math.min(2147483647,Math.max(0,Date.parse(preview.action.plan.expiresAt)-Date.now()+1)));return()=>clearTimeout(timer)},[preview]);
 const reviewable=Boolean(preview&&preview.action.status==='proposed'&&preview.action.requesterUserId!==currentUserId&&canApprove&&Date.parse(preview.action.plan.expiresAt)>Date.now()&&!held());
 async function run(kind:'preview'|'history'|'review'){
  if(!owns()||running.current||kind==='review'&&(!checked||!reviewable||!latest.current.canApprove))return;
  if(kind==='review'&&!remember()){setMessage('The local uncertainty marker cannot be kept. No decision was sent.');return}
  const original=preview;running.current=true;setBusy(true);setChecked(false);setMessage('');clear();setHistory(null);const c=new AbortController();active.current=c;
  try{
   if(!owns())return;
   if(kind==='preview'){
    const result=await client.preview(actionId,c.signal);if(!owns())return;if(!result.ok)throw Error('unavailable');const value=imageWorkflowPreview.parse(result.data);
    if(value.action.actionId!==actionId||value.action.plan.digest!==expectedPlanDigest||Date.parse(value.action.plan.expiresAt)<=Date.now())throw Error('mismatch');
    const binary=atob(value.bytesBase64url.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.bytesBase64url.length%4)%4)),bytes=Uint8Array.from(binary,v=>v.charCodeAt(0));
    try{const next=URL.createObjectURL(new Blob([bytes],{type:value.artifact.mimeType}));if(!owns()){URL.revokeObjectURL(next);return}url.current=next;setImageUrl(next);setPreview(value);setMessage('Exact image loaded. Inspect the image, account and both operations before your own decision.')}finally{bytes.fill(0)}
   }else{
    const result=kind==='history'?await client.inspect(actionId,c.signal):original?await client.review(original,c.signal):null;if(!owns())return;if(!result?.ok)throw Error('unconfirmed');const value=imageWorkflowHistory.parse(result.data);
    if(value.action.actionId!==actionId||value.action.plan.digest!==expectedPlanDigest||kind==='review'&&value.action.status!=='approved')throw Error('mismatch');
    setHistory(value);setMessage(kind==='review'?'Approval recorded. No image upload or post was executed.':'Original history loaded. It does not validate the current image source or authorize execution.');if(kind==='review'){try{onRecorded?.()}catch{/* A known saved decision remains known. */}}
   }
  }catch{if(owns()){clear();setMessage(kind==='review'?'Image approval result is unconfirmed. Read this same action; do not submit again automatically.':'Exact image evidence is unavailable. Keep the original action reference; no decision was sent.')}}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(!owns())return <p role="status">Account or action changed. Reopen this exact image record.</p>;
 return <section aria-label="Exact image review" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Managed image · prepared locally</p><h2 className="mt-2 text-xl font-medium">One image, two reviewed operations</h2><p className="mt-2 text-sm text-zinc-400">Review the exact image and account before initialization and upload. Publishing a post requires a separate later approval.</p></header>
  <div className="flex flex-wrap gap-3"><button className="btn-secondary" type="button" disabled={busy} onClick={()=>void run('preview')}>Load exact image preview</button><button className="btn-secondary" type="button" disabled={busy} onClick={()=>void run('history')}>Read saved image review</button></div>
  <p className="text-sm text-zinc-400">Native decoder, worker and upload-provider qualification remain unavailable. These prepared controls do not enable uploads.</p>
  {preview&&<>
   {imageUrl&&<figure><img src={imageUrl} alt="Exact image submitted for review" className="max-h-80 max-w-full rounded-lg object-contain"/><figcaption className="mt-2 text-xs text-zinc-400">Transient preview · cleared on close, expiry or account change</figcaption></figure>}
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt>Selected account</dt><dd className="break-all">{preview.artifact.author}</dd></div><div><dt>Image</dt><dd>{preview.artifact.mimeType} · {preview.artifact.width} × {preview.artifact.height} · {preview.artifact.byteCount} bytes</dd></div><div><dt>Review expiry</dt><dd>{preview.action.plan.expiresAt}</dd></div><div><dt>Saved state</dt><dd>{preview.action.status}</dd></div></dl>
   <ol className="list-decimal pl-5 space-y-2"><li>Initialize this exact image</li><li>Upload these exact bytes using the private derived grant</li></ol>
   <p className="text-sm text-zinc-400">The private upload address is never displayed. An uncertain initializer or upload must not be reset, cloned or retried automatically.</p>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy||!reviewable} onChange={event=>setChecked(event.target.checked)}/>I personally reviewed this exact image, account and both operations.</label>
   <button className="btn-primary" type="button" disabled={busy||!checked||!reviewable} onClick={()=>void run('review')}>Record independent image approval</button>
   {preview.action.requesterUserId===currentUserId&&<p>The requester cannot independently approve their own image.</p>}
  </>}
  {history&&<div><h3 className="font-medium">Saved review history</h3><p>{history.action.status} · {history.action.attemptCount} attempt</p><p className="text-sm text-zinc-400">Historical evidence only. Current source and execution authority were not established by this read.</p>{['claimed','unknown'].includes(history.action.status)&&<p role="alert">Keep this original consumed or uncertain record. Do not resend, reset or replace it automatically.</p>}</div>}
  <details><summary>Exact record references</summary><p className="break-all">{actionId}</p><p className="break-all">Plan: {expectedPlanDigest}</p>{preview&&<p className="break-all">Image SHA256: {preview.artifact.bytesDigest}</p>}</details>
  <p role="status" aria-live="polite">{busy?'Checking this exact image record…':message}</p>
 </section>;
}
