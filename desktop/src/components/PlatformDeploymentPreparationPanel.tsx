import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {z} from 'zod';
import {desktopClient} from '../lib/desktopClient';
import {PlatformSourcePicker} from './PlatformSourcePicker';
import type {PlatformSourceClient,PlatformDeploymentClient} from '../lib/platformReview';
import {platformDeploymentSelection} from '../../../lib/governance/platform/deploymentContract';
import {platformPreparationRequestId,platformPreparationReceiptSchema,platformPreparationLookupSchema} from '../../../lib/governance/platform/preparationContract';
type Selection=z.infer<typeof platformDeploymentSelection>;
interface Props{sourceClient?:PlatformSourceClient;client:Pick<PlatformDeploymentClient,'prepare'|'lookup'>;canPrepare:boolean;onSaved:(id:string)=>void}
/** Local/unregistered proposal UI only. No file upload, AI generation, approval
 * or execution. Uncertain saving never unlocks a fresh reference or resubmit. */
export function PlatformDeploymentPreparationPanel({sourceClient,client,canPrepare,onSaved}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const [leadId,setLeadId]=useState(''),[projectName,setProjectName]=useState(''),[environment,setEnvironment]=useState<'preview'|'production'>('preview'),[expiresAt,setExpiresAt]=useState('');
 const [reference,setReference]=useState<{requestId:string;selection:Selection}|null>(null),[submitted,setSubmitted]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const original=useRef<typeof reference>(null),held=useRef(false),running=useRef(false),alive=useRef(true),active=useRef<AbortController|null>(null);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 function keep(){
  if(!owns()||!canPrepare||original.current||held.current)return;
  try{const selection=platformDeploymentSelection.parse({leadId:leadId.trim(),projectName:projectName.trim(),environment,expiresAt}),value={requestId:platformPreparationRequestId.parse(crypto.randomUUID()),selection};original.current=value;setReference(value);setMessage('Original reference kept. Saving records a proposal only; it cannot deploy a site.')}
  catch{setMessage('Enter the existing lead, exact project name and valid UTC ISO expiry.')}
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
 return <section aria-label="Prepare generated-site deployment proposal" className="rounded-xl border border-white/10 p-5 space-y-4">
  <header><h2 className="text-lg font-medium">Prepare existing generated-site content</h2><p className="text-sm text-zinc-400">The server reads the saved Lead package and derives exact files. This is not Axiom's own application release. No AI call or deployment runs here.</p></header>
  {!current&&<p role="alert">Account context changed. Keep the original reference and reopen the workflow.</p>}
  {sourceClient&&<PlatformSourcePicker mode="leads" client={sourceClient} disabled={locked} onSelect={(kind,id)=>{if(kind==='leads'&&owns()&&!original.current&&!held.current&&canPrepare)setLeadId(id)}}/>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label>Existing lead ID<input value={leadId} disabled={locked} onChange={e=>setLeadId(e.target.value)}/></label>
   <label>Exact Vercel project name<input value={projectName} disabled={locked} onChange={e=>setProjectName(e.target.value)}/></label>
   <label>Planned environment<select value={environment} disabled={locked} onChange={e=>{if(e.target.value==='preview'||e.target.value==='production')setEnvironment(e.target.value)}}><option value="preview">Preview plan only</option><option value="production">Production plan only</option></select></label>
   <label>Deployment review expiry (UTC ISO time)<input value={expiresAt} disabled={locked} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" onChange={e=>setExpiresAt(e.target.value)}/></label>
  </div>
  <p className="text-xs text-zinc-400">A future authorized send could create the named project. Independent review, exact target, current permissions and separate deployment/spending approval remain required. Execution is unavailable in this prepared workflow.</p>
  {!reference?<button type="button" className="btn-secondary" disabled={locked} onClick={keep}>Keep deployment proposal reference</button>:<>
   <label>Original deployment reference<input readOnly value={reference.requestId}/></label>
   <div className="flex flex-wrap gap-3">{!submitted&&<button type="button" className="btn-secondary" disabled={!current||busy||!canPrepare} onClick={()=>{if(owns()&&!running.current&&!held.current){original.current=null;setReference(null);setMessage('Unsent selection reopened. Nothing was saved.')}}}>Edit unsent deployment selection</button>}<button type="button" className="btn-primary" disabled={!current||!canPrepare||busy||submitted} onClick={()=>void run('save')}>Save deployment proposal only</button><button type="button" className="btn-secondary" disabled={!current||busy} onClick={()=>void run('lookup')}>Look up original deployment reference</button></div>
  </>}
  <p role="status" aria-live="polite">{busy?'Checking the original deployment reference…':message}</p>
 </section>;
}
