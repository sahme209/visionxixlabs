import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {z} from 'zod';
import {desktopClient} from '../lib/desktopClient';
import type {CustodianClient} from '../lib/custodian';
import {custodianDrainSelection} from '../../../lib/governance/platform/operations/custodianDrainSelection';
import {custodianPreparationReceipt,custodianLookup} from '../../../lib/governance/platform/operations/custodianClientContract';
import {platformPreparationRequestId} from '../../../lib/governance/platform/preparationContract';
type Selection=z.infer<typeof custodianDrainSelection>;
interface Props{client:Pick<CustodianClient,'prepare'|'lookup'>;canPrepare:boolean;onSaved:(id:string)=>void}
/** Prepared metadata only; requested digests never establish protected source
 * qualification. An uncertain submission retains its original reference. */
export function CustodianPreparationPanel({client,canPrepare,onSaved}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,apiBase:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,client}).current;
 const latest=useRef({client,canPrepare,onSaved});latest.current={client,canPrepare,onSaved};
 const [operation,setOperation]=useState<'begin'|'abort'>('begin'),[accountId,setAccountId]=useState(''),[roleArn,setRoleArn]=useState(''),[issuer,setIssuer]=useState(''),[source,setSource]=useState(''),[predecessor,setPredecessor]=useState(''),[generation,setGeneration]=useState(''),[version,setVersion]=useState(''),[expiry,setExpiry]=useState(''),[existing,setExisting]=useState('');
 const [reference,setReference]=useState<{requestId:string;selection:Selection|null}|null>(null),[submitted,setSubmitted]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[savedAction,setSavedAction]=useState('');
 const original=useRef<typeof reference>(null),held=useRef(false),running=useRef(false),alive=useRef(true),active=useRef<AbortController|null>(null);
 const owns=()=>alive.current&&desktopClient.getContextRevision()===owner.revision&&desktopClient.config===owner.config&&desktopClient.config.apiBase===owner.apiBase&&desktopClient.config.sessionToken===owner.token&&latest.current.client===owner.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 function keep(){
  if(!owns()||!latest.current.canPrepare||original.current||held.current)return;
  try{if(!/^\d+$/.test(generation)||version!==''&&!/^\d+$/.test(version))throw Error('invalid');const selection=custodianDrainSelection.parse({format:1,scope:'platform',operation,custodian:{accountId:accountId.trim(),roleArn:roleArn.trim()},issuerProfileDigest:issuer.trim(),sourceEvidenceDigest:source.trim(),predecessorAdmissionDigest:predecessor.trim(),expectedGeneration:Number(generation),expectedVersion:version===''?null:Number(version),expiresAt:expiry,...(operation==='abort'?{restoredAdmissionDigest:predecessor.trim()}:{})});if(Date.parse(selection.expiresAt)<=Date.now())throw Error('expired');const value={requestId:platformPreparationRequestId.parse(crypto.randomUUID()),selection};original.current=value;setReference(value);setMessage('Original reference kept. Save prepares a proposal only; it does not drain or restore issuance.')}
  catch{setMessage('Enter the exact account, role, reviewed evidence digests, matching generation/version and a future UTC expiry. Generation zero requires no prior version; abort requires an existing drained generation.')}
 }
 function recover(){if(!owns()||original.current||running.current)return;const p=platformPreparationRequestId.safeParse(existing.trim());if(!p.success){setMessage('Enter the original UUID request reference.');return}const value={requestId:p.data,selection:null};original.current=value;held.current=true;setReference(value);setSubmitted(true);void run('lookup')}
 async function run(kind:'save'|'lookup'){
  const selected=original.current;if(!owns()||running.current||!selected||kind==='save'&&(!latest.current.canPrepare||held.current||!selected.selection))return;
  if(kind==='save'){held.current=true;setSubmitted(true)}running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  try{
   const result=kind==='save'?await client.prepare(selected.selection,selected.requestId,c.signal):await client.lookup(selected.requestId,c.signal);if(!owns())return;if(!result.ok)throw Error('unconfirmed');
   let actionId:string|undefined;
   if(kind==='save'){const p=custodianPreparationReceipt.safeParse(result.data);if(!p.success||p.data.requestId!==selected.requestId)throw Error('mismatch');actionId=p.data.actionId;setMessage('Proposal saved. Inspect its exact source; independent approval and requester execution remain separate.')}
   else{const p=custodianLookup.safeParse(result.data);if(!p.success||p.data.requestId!==selected.requestId)throw Error('mismatch');if(p.data.found){actionId=p.data.actionId;held.current=true;setSubmitted(true);setMessage('Original proposal found. No expiry, approval or attempt was renewed.')}else setMessage('No original proposal was found for this session. Keep this reference; do not submit a replacement automatically.')}
   if(actionId){setSavedAction(actionId);try{latest.current.onSaved(actionId)}catch{setMessage('Original proposal is saved. Reload the surrounding view using its saved action reference; no proposal was repeated.')}}
  }catch{if(owns())setMessage(kind==='save'?'Saving is unconfirmed. Look up this original reference; do not save again or create a replacement.':'Original lookup is unavailable. Retain the reference; no proposal was submitted.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 const current=revision===owner.revision&&owns(),locked=!current||!canPrepare||Boolean(reference);
 return <section aria-label="Prepare issuer control" aria-busy={busy} className="rounded-xl border border-white/10 p-5 space-y-4">
  <header><h2 className="text-lg font-medium">Prepare one issuer control</h2><p className="text-sm text-zinc-400">Identify the exact role and reviewed source. Saving creates only a proposal; it cannot revoke credentials, stop a service or prove closure.</p></header>
  {!current&&<p role="alert">Account context changed. Preserve the original reference and reopen in the current session.</p>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label>Issuer control<select disabled={locked} value={operation} onChange={e=>{if(e.target.value==='begin'||e.target.value==='abort')setOperation(e.target.value)}}><option value="begin">Begin issuance drain</option><option value="abort">Abort drain / restore exact predecessor</option></select></label>
   <label>AWS account ID<input disabled={locked} value={accountId} onChange={e=>setAccountId(e.target.value)} inputMode="numeric"/></label>
   <label>Custodian role ARN<input disabled={locked} value={roleArn} onChange={e=>setRoleArn(e.target.value)}/></label>
   <label>Review expiry (UTC ISO)<input disabled={locked} value={expiry} onChange={e=>setExpiry(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"/></label>
   <label>Expected generation<input disabled={locked} value={generation} onChange={e=>setGeneration(e.target.value)} inputMode="numeric"/></label>
   <label>Expected barrier version (blank only for generation zero)<input disabled={locked} value={version} onChange={e=>setVersion(e.target.value)} inputMode="numeric"/></label>
  </div>
  <details><summary>Reviewed source references</summary><div className="grid gap-3 sm:grid-cols-2"><label>Issuer profile digest<input disabled={locked} value={issuer} onChange={e=>setIssuer(e.target.value)}/></label><label>Source evidence digest<input disabled={locked} value={source} onChange={e=>setSource(e.target.value)}/></label><label>Predecessor admission digest<input disabled={locked} value={predecessor} onChange={e=>setPredecessor(e.target.value)}/></label></div><p>References are requested metadata, not proof of custody, fleet coverage or current admission. The private server must qualify them. Abort can restore only this exact predecessor after fresh closure checks.</p></details>
  {!reference?<>
   <button type="button" className="btn-secondary" disabled={locked} onClick={keep}>Keep issuer control reference</button>
   <details><summary>Recover an existing request</summary><label>Existing control request reference<input disabled={!current||busy} value={existing} onChange={e=>setExisting(e.target.value)}/></label><button type="button" className="btn-secondary" disabled={!current||busy} onClick={recover}>Recover existing control reference</button><p>Use the original request UUID in the original authorized session. Recovery never creates a replacement.</p></details>
  </>:<>
   <label>Original issuer control reference<input readOnly value={reference.requestId}/></label>
   <div className="flex flex-wrap gap-3">{!submitted&&<button type="button" className="btn-secondary" disabled={!current||busy||!canPrepare} onClick={()=>{if(owns()&&!running.current&&!held.current){original.current=null;setReference(null);setMessage('Unsent selection reopened. Nothing was submitted.')}}}>Edit unsent control</button>}<button type="button" className="btn-primary" disabled={!current||!canPrepare||busy||submitted||!reference.selection} onClick={()=>void run('save')}>Save control proposal only</button><button type="button" className="btn-secondary" disabled={!current||busy} onClick={()=>void run('lookup')}>Look up original control reference</button></div>
  </>}
  {savedAction&&<label>Saved issuer control action<input readOnly value={savedAction}/></label>}
  <p role="status" aria-live="polite">{busy?'Checking the original control reference…':message}</p>
 </section>;
}
