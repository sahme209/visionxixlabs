import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {z} from 'zod';
import {desktopClient} from '../lib/desktopClient';
import type {PlatformTemplateClient} from '../lib/platformReview';
import {platformTemplateSelection} from '../../../lib/governance/platform/templateContract';
import {platformPreparationRequestId,platformPreparationReceiptSchema,platformPreparationLookupSchema} from '../../../lib/governance/platform/preparationContract';
type Selection=z.infer<typeof platformTemplateSelection>;
interface Props{client:Pick<PlatformTemplateClient,'prepare'|'lookup'>;canPrepare:boolean;onSaved:(id:string)=>void}
/** Local/unregistered proposal UI only. No file upload, resource creation, approval
 * or execution. Uncertain saving never unlocks a fresh reference or resubmit. */
export function PlatformTemplatePreparationPanel({client,canPrepare,onSaved}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const [operation,setOperation]=useState<'create_bucket'|'upload'|'access'>('upload'),[accountId,setAccountId]=useState(''),[region,setRegion]=useState<'us-east-1'|'us-east-2'>('us-east-2'),[expiresAt,setExpiresAt]=useState('');
 const [objectVersion,setObjectVersion]=useState(''),[recipientDigest,setRecipientDigest]=useState(''),[ttlSeconds,setTtlSeconds]=useState('');
 const [reference,setReference]=useState<{requestId:string;selection:Selection}|null>(null),[submitted,setSubmitted]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const original=useRef<typeof reference>(null),held=useRef(false),running=useRef(false),alive=useRef(true),active=useRef<AbortController|null>(null);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 function keep(){
  if(!owns()||!canPrepare||original.current||held.current)return;
  try{const selection=platformTemplateSelection.parse({operation,accountId:accountId.trim(),region,expiresAt,...(operation==='access'?{objectVersion:objectVersion.trim(),recipientDigest:recipientDigest.trim(),ttlSeconds:Number(ttlSeconds)}:{})}),value={requestId:platformPreparationRequestId.parse(crypto.randomUUID()),selection};if(Date.parse(selection.expiresAt)<=Date.now()||selection.operation==='create_bucket'&&selection.region==='us-east-1')throw Error('unavailable');original.current=value;setReference(value);setMessage('Original reference kept. Saving records this proposal only; it cannot create a bucket, upload or grant access.')}
  catch{setMessage('Enter valid exact template targets and a future UTC ISO expiry. Bucket creation requires us-east-2; access requires an exact version, recipient digest and duration from 1 to 3600 seconds.')}
 }
 async function run(kind:'save'|'lookup'){
  const selected=original.current;if(!owns()||running.current||!selected||kind==='save'&&(!canPrepare||held.current))return;
  if(kind==='save'){held.current=true;setSubmitted(true)}running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  try{
   const result=kind==='save'?await client.prepare(selected.selection,selected.requestId,c.signal):await client.lookup(selected.requestId,c.signal);if(!owns())return;if(!result.ok)throw Error('unconfirmed');
   if(kind==='save'){
    const saved=platformPreparationReceiptSchema.safeParse(result.data);if(!saved.success||saved.data.requestId!==selected.requestId)throw Error('mismatch');setMessage('Proposal reference found. Inspect its exact source; approval and execution remain separate.');onSaved(saved.data.actionId);
   }else{
    const saved=platformPreparationLookupSchema.safeParse(result.data);if(!saved.success||saved.data.requestId!==selected.requestId)throw Error('mismatch');
    if(saved.data.found){held.current=true;setSubmitted(true);setMessage('Original saved proposal found. Its expiry and approvals were not renewed.');onSaved(saved.data.actionId)}else setMessage('No original proposal was found for this session. Retain the reference and inspect history; do not resubmit automatically.');
   }
  }catch{if(owns())setMessage(kind==='save'?'Saving is unconfirmed. Look up this original reference; do not save again or create a replacement.':'Original-reference lookup is unavailable. Retain the reference; no save was repeated.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 const current=revision===owner.revision&&owns(),locked=!current||!canPrepare||Boolean(reference);
 return <section aria-label="Prepare template proposal" className="rounded-xl border border-white/10 p-5 space-y-4">
  <header><h2 className="text-lg font-medium">Prepare one exact template operation</h2><p className="text-sm text-zinc-400">The server derives bucket/key/content from the fixed Axiom template. Saving creates only a review proposal, never an AWS resource or URL.</p></header>
  {!current&&<p role="alert">Account context changed. Keep the original reference and reopen the workflow.</p>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label>Template operation<select value={operation} disabled={locked} onChange={e=>{if(e.target.value==='create_bucket'||e.target.value==='upload'||e.target.value==='access')setOperation(e.target.value)}}><option value="upload">Upload exact template</option><option value="create_bucket">Create template bucket</option><option value="access">Grant version-specific access</option></select></label>
   <label>Target AWS account ID<input value={accountId} disabled={locked} inputMode="numeric" onChange={e=>setAccountId(e.target.value)}/></label>
   <label>Template region<select value={region} disabled={locked} onChange={e=>{if(e.target.value==='us-east-1'||e.target.value==='us-east-2')setRegion(e.target.value)}}><option value="us-east-2">us-east-2</option><option value="us-east-1" disabled={operation==='create_bucket'}>us-east-1 · existing versioned objects only</option></select></label>
   <label>Template review expiry (UTC ISO time)<input value={expiresAt} disabled={locked} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" onChange={e=>setExpiresAt(e.target.value)}/></label>
   {operation==='access'&&<><label>Exact object version<input value={objectVersion} disabled={locked} onChange={e=>setObjectVersion(e.target.value)}/></label><label>Intended recipient reference digest<input value={recipientDigest} disabled={locked} onChange={e=>setRecipientDigest(e.target.value)}/></label><label>Access duration (seconds)<input type="number" min="1" max="3600" step="1" value={ttlSeconds} disabled={locked} onChange={e=>setTtlSeconds(e.target.value)}/></label></>}
  </div>
  <p className="text-xs text-zinc-400">These are requested targets, not verified account ownership or object-version presence. A future access grant is a transferable bearer URL; a recipient reference does not prevent sharing. Source review, independent approval, current permissions and separate execution remain required. Template execution is unavailable in this prepared workflow.</p>
  {!reference?<button type="button" className="btn-secondary" disabled={locked} onClick={keep}>Keep template proposal reference</button>:<>
   <label>Original template reference<input readOnly value={reference.requestId}/></label>
   <div className="flex flex-wrap gap-3">{!submitted&&<button type="button" className="btn-secondary" disabled={!current||busy||!canPrepare} onClick={()=>{if(owns()&&!running.current&&!held.current){original.current=null;setReference(null);setMessage('Unsent selection reopened. Nothing was saved.')}}}>Edit unsent template selection</button>}<button type="button" className="btn-primary" disabled={!current||!canPrepare||busy||submitted} onClick={()=>void run('save')}>Save template proposal only</button><button type="button" className="btn-secondary" disabled={!current||busy} onClick={()=>void run('lookup')}>Look up original template reference</button></div>
  </>}
  <p role="status" aria-live="polite">{busy?'Checking the original template reference…':message}</p>
 </section>;
}
