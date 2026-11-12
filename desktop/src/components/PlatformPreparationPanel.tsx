import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {PlatformSourcePicker} from './PlatformSourcePicker';
import type {PlatformSourceClient,PlatformPreparationClient} from '../lib/platformReview';
import {growthPreparationSelection,platformPreparationRequestId,platformPreparationReceiptSchema,platformPreparationLookupSchema} from '../../../lib/governance/platform/preparationContract';
import type {z} from 'zod';
type Selection=z.infer<typeof growthPreparationSelection>;
interface Props{sourceClient?:PlatformSourceClient;client:PlatformPreparationClient;canPrepare:boolean;onSaved:(id:string)=>void}
/** Unregistered proposal surface. Keeps the original reference BEFORE save;
 * a consumed save control has no reset, renewal or automatic retry path. */
export function PlatformPreparationPanel({sourceClient,client,canPrepare,onSaved}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const [operation,setOperation]=useState<Selection['operation']>('publish'),[draftId,setDraftId]=useState(''),[connectionId,setConnectionId]=useState(''),[expiresAt,setExpiresAt]=useState(''),[scheduledFor,setScheduledFor]=useState('');
 const [reference,setReference]=useState<{requestId:string;selection:Selection}|null>(null),[submitted,setSubmitted]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const ref=useRef<typeof reference>(null),held=useRef(false),running=useRef(false),alive=useRef(true),active=useRef<AbortController|null>(null);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 function keep(){
  if(!owns()||!canPrepare||ref.current||held.current)return;
  try{
   const selection=growthPreparationSelection.parse({operation,draftId:draftId.trim(),connectionId:connectionId.trim(),expiresAt,...(operation==='schedule'?{scheduledFor}:{})});
   const value={requestId:platformPreparationRequestId.parse(crypto.randomUUID()),selection};ref.current=value;setReference(value);setMessage('Original reference kept. Saving creates a proposal only; it does not approve or execute it.');
  }catch{setMessage('Enter exact source IDs and valid UTC ISO times before keeping a reference.')}
 }
 async function run(kind:'save'|'lookup'){
  const original=ref.current;if(!owns()||running.current||!original||kind==='save'&&(!canPrepare||held.current))return;
  if(kind==='save'){held.current=true;setSubmitted(true)}running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  try{
   const result=kind==='save'?await client.prepare(original.selection,original.requestId,c.signal):await client.lookup(original.requestId,c.signal);
   if(!owns())return;
   if(!result.ok)throw Error('unconfirmed');
   if(kind==='save'){
    const receipt=platformPreparationReceiptSchema.safeParse(result.data);if(!receipt.success||receipt.data.requestId!==original.requestId)throw Error('unconfirmed');
    setMessage('Saved reference found. Inspect its exact recorded plan; no approval or operation occurred.');onSaved(receipt.data.actionId);
   }else{
    const lookup=platformPreparationLookupSchema.safeParse(result.data);if(!lookup.success||lookup.data.requestId!==original.requestId)throw Error('unconfirmed');
    if(lookup.data.found){held.current=true;setSubmitted(true);setMessage('Original saved action found. Its recorded history does not renew authority.');onSaved(lookup.data.actionId)}
    else setMessage('No saved reference was found for this session. Do not resubmit automatically; inspect saved history and retain this reference.');
   }
  }catch{if(owns())setMessage(kind==='save'?'Saving is unconfirmed. Look up this original reference; do not save again or create a replacement.':'Lookup is unavailable. Retain the original reference and inspect saved history; no save was repeated.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 const current=revision===owner.revision&&owns(),locked=Boolean(reference)||!canPrepare||!current;
 return <section aria-label="Prepare platform proposal" className="rounded-xl border border-white/10 p-5 space-y-4">
  <header><h2 className="text-lg font-medium">Prepare an exact growth change</h2><p className="text-sm text-zinc-400">Select existing source records. The server derives the content and account revision; no action is approved here.</p></header>
  {!current&&<p role="alert">Account context changed. Retain the original reference; reopen the workflow in the current session.</p>}
  {sourceClient&&<PlatformSourcePicker client={sourceClient} disabled={locked} onSelect={(kind,id)=>{if(owns()&&!ref.current&&!held.current&&canPrepare){if(kind==='drafts')setDraftId(id);else if(kind==='accounts')setConnectionId(id)}}}/>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label>Operation<select value={operation} disabled={locked} onChange={e=>{const op=e.target.value;if(op==='publish'||op==='schedule'||op==='delete')setOperation(op)}}><option value="publish">Publish existing draft</option><option value="schedule">Change schedule only</option><option value="delete">Delete managed published post</option></select></label>
   <label>Draft ID<input value={draftId} disabled={locked} onChange={e=>setDraftId(e.target.value)}/></label>
   <label>Connected account ID<input value={connectionId} disabled={locked} onChange={e=>setConnectionId(e.target.value)}/></label>
   <label>Review expiry (UTC ISO time)<input value={expiresAt} disabled={locked} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" onChange={e=>setExpiresAt(e.target.value)}/></label>
   {operation==='schedule'&&<label>Publication time (UTC ISO time)<input value={scheduledFor} disabled={locked} onChange={e=>setScheduledFor(e.target.value)}/></label>}
  </div>
  {!reference?<button type="button" className="btn-secondary" disabled={locked} onClick={keep}>Keep exact proposal reference</button>:<>
   <label>Original proposal reference<input readOnly value={reference.requestId}/></label>
   <p className="text-xs text-zinc-400">Keep this reference until the saved action is confirmed. Lookup is read-only and never renews a review window.</p>
   <div className="flex flex-wrap gap-3">{!submitted&&<button type="button" className="btn-secondary" disabled={!current||busy||!canPrepare} onClick={()=>{if(owns()&&!running.current&&!held.current){ref.current=null;setReference(null);setMessage('Unsent selection reopened. Nothing was saved.')}}}>Edit unsent selection</button>}<button type="button" className="btn-primary" disabled={!current||busy||submitted||!canPrepare} onClick={()=>void run('save')}>Save this exact proposal</button><button type="button" className="btn-secondary" disabled={!current||busy} onClick={()=>void run('lookup')}>Look up this original reference</button></div>
  </>}
  <p role="status" aria-live="polite">{busy?'Checking the original proposal reference…':message}</p>
 </section>;
}
