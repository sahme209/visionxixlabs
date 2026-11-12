import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {DeploymentRecoveryClient} from '../lib/deploymentRecovery';
import {deploymentRecoverySelection} from '../../../lib/governance/platform/deploymentRecoveryCommand';
import {deploymentRecoveryPreparationReceipt,deploymentRecoveryLookup} from '../../../lib/governance/platform/deploymentRecoveryClientContract';
import {deploymentRequestReceiptView,type DeploymentHistoryView} from '../../../lib/governance/platform/deploymentHistoryContract';
interface Props{receipt:DeploymentHistoryView['requests'][number];currentUserId:string;canPrepare:boolean;client:DeploymentRecoveryClient;onSaved:(id:string)=>void}
/** A separate metadata proposal only. Original receipt fields cannot be edited;
 * current server target/source qualification and later real human review decide. */
export function DeploymentRecoveryPreparationPanel({receipt,currentUserId,canPrepare,client,onSaved}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),signature=JSON.stringify(receipt),owner=useRef({revision,config:desktopClient.config,base:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,signature,currentUserId,client}).current;
 const latest=useRef({signature,currentUserId,client,canPrepare});latest.current={signature,currentUserId,client,canPrepare};
 const alive=useRef(true),invalidated=useRef(false),running=useRef(false),attempted=useRef(false),active=useRef<AbortController|null>(null);
 const [profile,setProfile]=useState(''),[expiresAt,setExpiresAt]=useState(''),[kept,setKept]=useState<{selection:ReturnType<typeof deploymentRecoverySelection.parse>;requestId:string}|null>(null),[held,setHeld]=useState(false),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[message,setMessage]=useState('');
 function owns(){const same=owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config&&owner.base===desktopClient.config.apiBase&&owner.token===desktopClient.config.sessionToken&&latest.current.signature===owner.signature&&latest.current.currentUserId===owner.currentUserId&&latest.current.client===owner.client;if(!same)invalidated.current=true;return alive.current&&!invalidated.current&&same}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const parsed=deploymentRequestReceiptView.safeParse(receipt),eligible=parsed.success&&parsed.data.outcome==='accepted'&&parsed.data.providerDeploymentId!==null;
 function keep(){if(!owns()){setStale(true);return}if(!eligible||!latest.current.canPrepare||kept||running.current)return;const selection=deploymentRecoverySelection.safeParse({nativeKey:receipt.nativeKey,requestReceiptId:receipt.receiptId,profileDigest:profile,expiresAt});if(!selection.success||Date.parse(expiresAt)<=Date.now()){setMessage('Enter the configured profile digest and a future UTC review expiry.');return}setKept({selection:selection.data,requestId:crypto.randomUUID()});setMessage('Original recovery reference kept. Saving this proposal records no approval or provider observation.')}
 async function run(kind:'save'|'lookup'){
  if(!owns()){setStale(true);return}if(!kept||running.current||kind==='save'&&(!eligible||!latest.current.canPrepare||attempted.current||Date.parse(kept.selection.expiresAt)<=Date.now()))return;
  running.current=true;const c=new AbortController();active.current=c;setBusy(true);setMessage('');if(kind==='save'){attempted.current=true;setHeld(true)}
  try{
   const response=kind==='save'?await client.prepare(kept.selection,kept.requestId,c.signal):await client.lookup(kept.requestId,c.signal);if(!owns()){if(alive.current)setStale(true);return}if(!response.ok)throw Error('unconfirmed');
   const saved=(kind==='save'?deploymentRecoveryPreparationReceipt:deploymentRecoveryLookup).safeParse(response.data);if(!saved.success||saved.data.requestId!==kept.requestId.toLowerCase())throw Error('mismatch');
   if('found' in saved.data&&!saved.data.found){setMessage('No saved recovery was found for this original reference. This read does not authorize an automatic resubmission.');return}
   if(!('actionId' in saved.data))throw Error('mismatch');setMessage('Separate recovery proposal saved. Load it for a genuine independent decision; nothing was observed or released.');try{void Promise.resolve(onSaved(saved.data.actionId)).catch(()=>{})}catch{/* Preserve the known saved reference. */}
  }catch{if(owns())setMessage(kind==='save'?'Recovery proposal saving is unconfirmed. Look up this same original reference; do not save again automatically.':'Original recovery lookup is unavailable. Keep the same reference.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 if(stale||revision!==owner.revision||!owns())return <p role="status">Account or original receipt changed. Reopen this recovery preparation.</p>;
 if(!eligible)return <p>Recovery preparation requires a known accepted provider reference. Unknown-without-reference work stays unresolved.</p>;
 return <section aria-label="Prepare separate deployment recovery" aria-busy={busy} className="space-y-4 border-t border-white/10 pt-4">
  <header><h3 className="font-medium">Prepare a separate release observation</h3><p className="mt-2 text-sm text-zinc-400">This keeps the original send unchanged. A qualified native profile, genuine independent review and one later read-only observation are required before the held generation can be released.</p></header>
  <p>Original provider reference: {receipt.providerDeploymentId} · generation {receipt.generation}</p>
  <details><summary>Original request references</summary><p className="break-all">{receipt.receiptId}</p><p className="break-all">{receipt.receiptDigest}</p></details>
  <label className="block text-sm">Qualified native profile digest<input className="mt-1 w-full" value={profile} disabled={!canPrepare||Boolean(kept)||busy} onChange={e=>setProfile(e.target.value)}/></label><p className="text-xs text-zinc-400">Use the platform operator’s reviewed profile reference. Entering a digest cannot qualify a provider or enable a default.</p>
  <label className="block text-sm">Recovery review expiry (UTC ISO time)<input className="mt-1 w-full" value={expiresAt} disabled={!canPrepare||Boolean(kept)||busy} onChange={e=>setExpiresAt(e.target.value)}/></label>
  {!kept?<button type="button" className="btn-secondary" disabled={!canPrepare||busy} onClick={keep}>Keep this recovery reference</button>:<><p className="text-xs text-zinc-400">Keep this original reference before saving:</p><p className="break-all font-mono text-xs">{kept.requestId}</p><div className="flex flex-wrap gap-3"><button type="button" className="btn-primary" disabled={!canPrepare||busy||held} onClick={()=>void run('save')}>Save separate recovery proposal</button><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run('lookup')}>Look up this recovery reference</button></div></>}
  <p role="status" aria-live="polite">{busy?'Checking the original recovery reference…':message}</p>
 </section>;
}
