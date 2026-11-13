import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {z} from 'zod';
import {desktopClient} from '../lib/desktopClient';
import type {OperationalPreparationClient} from '../lib/operationalReview';
import {operationalEcsManifest} from '../../../lib/governance/platform/operations/contracts';
import {ecsPreparationReceipt,ecsPreparationLookup} from '../../../lib/governance/platform/operations/ecsPreparationClientContract';
import {platformPreparationRequestId} from '../../../lib/governance/platform/preparationContract';
type Selection=z.infer<typeof operationalEcsManifest>;
const initial={accountId:'',region:'',clusterArn:'',serviceArn:'',taskDefinitionArn:'',roleArn:'',repository:'',commit:'',workflowCommit:'',workflowSha256:'',runId:'',attempt:'',environment:'',protectionRevision:'',issuerProfileDigest:'',sourceEvidenceId:'',expiresAt:'',failedActionId:'',failureReceiptId:'',priorDeploymentReceiptId:'',generation:'',failedTaskDefinitionArn:''};
type Field=keyof typeof initial;
const targetFields:readonly [Field,string][]=[['accountId','AWS account ID'],['region','AWS region'],['clusterArn','ECS cluster ARN'],['serviceArn','ECS service ARN'],['taskDefinitionArn','Exact task definition ARN']];
const runFields:readonly [Field,string][]=[['repository','Repository'],['commit','Source commit'],['runId','Existing run ID'],['attempt','Run attempt'],['environment','Protected environment']];
const evidenceFields:readonly [Field,string][]=[['roleArn','Execution role ARN'],['workflowCommit','Workflow source commit'],['workflowSha256','Workflow content digest'],['protectionRevision','Protection revision digest'],['issuerProfileDigest','Issuer profile digest'],['sourceEvidenceId','Source evidence reference']];
const failureFields:readonly [Field,string][]=[['failedActionId','Original failed action reference'],['failureReceiptId','Native terminal-failure receipt'],['priorDeploymentReceiptId','Prior deployment receipt'],['generation','Original failed generation'],['failedTaskDefinitionArn','Original failed task definition ARN']];
interface Props{client:OperationalPreparationClient;canPrepare:boolean;onSaved:(id:string)=>void}
/** Prepared exact proposal only. Requested run/profile/evidence references are
 * not verified source or workload authority. No workflow or provider dispatch. */
export function OperationalEcsPreparationPanel({client,canPrepare,onSaved}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,apiBase:desktopClient.config.apiBase,token:desktopClient.config.sessionToken,client}).current;
 const latest=useRef({client,canPrepare,onSaved});latest.current={client,canPrepare,onSaved};
 const [values,setValues]=useState(initial),[operation,setOperation]=useState<'force'|'rollback'>('force'),[existing,setExisting]=useState(''),[reference,setReference]=useState<{requestId:string;selection:Selection|null}|null>(null),[submitted,setSubmitted]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[savedAction,setSavedAction]=useState('');
 const original=useRef<typeof reference>(null),running=useRef(false),held=useRef(false),alive=useRef(true),active=useRef<AbortController|null>(null);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config&&owner.apiBase===desktopClient.config.apiBase&&owner.token===desktopClient.config.sessionToken&&owner.client===latest.current.client;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 function keep(){
  if(!owns()||!latest.current.canPrepare||original.current||held.current)return;
  try{
   const v=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value.trim()]));
   if(!/^\d+$/.test(v.attempt)||!v.issuerProfileDigest||!v.environment||!v.protectionRevision||operation==='rollback'&&!/^\d+$/.test(v.generation))throw Error('invalid');
   const selection=operationalEcsManifest.parse({format:1,scope:'platform',kind:'deployment.ecs',operation,expiresAt:v.expiresAt,issuerProfileDigest:v.issuerProfileDigest,target:{accountId:v.accountId,region:v.region,clusterArn:v.clusterArn,serviceArn:v.serviceArn,taskDefinitionArn:v.taskDefinitionArn},roleArn:v.roleArn,workload:{repository:v.repository,ref:'refs/heads/main',commit:v.commit,workflowCommit:v.workflowCommit,workflowPath:'.github/workflows/axiom-deploy-aws-ecs.yml',workflowSha256:v.workflowSha256,runId:v.runId,attempt:Number(v.attempt),environment:v.environment,protectionRevision:v.protectionRevision},sourceEvidenceId:v.sourceEvidenceId,...(operation==='rollback'?{condition:{kind:'verified_terminal_failure',failedActionId:v.failedActionId,failureReceiptId:v.failureReceiptId,priorDeploymentReceiptId:v.priorDeploymentReceiptId,generation:Number(v.generation),failedTaskDefinitionArn:v.failedTaskDefinitionArn}}:{})});
   if(Date.parse(selection.expiresAt)<=Date.now())throw Error('expired');const selected={requestId:platformPreparationRequestId.parse(crypto.randomUUID()),selection};original.current=selected;setReference(selected);setMessage('Original reference kept. Saving records only this exact proposal; no workflow or deployment starts.');
  }catch{setMessage('Enter the exact matching target, already-created run, protected profile/evidence references and future review expiry. Rollback also requires exact original native failure/prior-deployment references; a timeout or unknown result is not failure proof.')}
 }
 function recover(){if(!owns()||running.current||original.current)return;const p=platformPreparationRequestId.safeParse(existing.trim());if(!p.success){setMessage('Enter the original UUID request reference.');return}const selected={requestId:p.data,selection:null};original.current=selected;held.current=true;setReference(selected);setSubmitted(true);void run('lookup')}
 async function run(kind:'save'|'lookup'){
  const selected=original.current;if(!owns()||running.current||!selected||kind==='save'&&(!latest.current.canPrepare||held.current||!selected.selection))return;
  running.current=true;setBusy(true);setMessage('');if(kind==='save'){held.current=true;setSubmitted(true)}const c=new AbortController();active.current=c;
  try{
   const response=kind==='save'?await client.prepare(selected.selection,selected.requestId,c.signal):await client.lookup(selected.requestId,c.signal);if(!owns())return;if(!response.ok)throw Error('unconfirmed');let actionId:string|undefined;
   if(kind==='save'){const p=ecsPreparationReceipt.safeParse(response.data);if(!p.success||p.data.requestId!==selected.requestId)throw Error('mismatch');actionId=p.data.actionId;setMessage('Proposal saved. Independent source review and requester delegation remain separate. No workflow was started.')}
   else{const p=ecsPreparationLookup.safeParse(response.data);if(!p.success||p.data.requestId!==selected.requestId)throw Error('mismatch');if(p.data.found){actionId=p.data.actionId;held.current=true;setSubmitted(true);setMessage('Original proposal found. No source, expiry or approval was renewed.')}else setMessage('No original proposal was found for this session. Keep this reference; do not submit a replacement automatically.')}
   if(actionId){setSavedAction(actionId);try{latest.current.onSaved(actionId)}catch{setMessage('Original proposal is saved. Use its displayed action reference to reload the surrounding view; no save was repeated.')}}
  }catch{if(owns())setMessage(kind==='save'?'Saving is unconfirmed. Look up this original reference; do not save again or create a replacement.':'Original lookup is unavailable. Keep the reference; no preparation was repeated.')}
  finally{running.current=false;if(owns())setBusy(false)}
 }
 const current=revision===owner.revision&&owns(),locked=!current||!canPrepare||Boolean(reference);
 function fields(items:readonly [Field,string][]){return <div className="grid gap-3 sm:grid-cols-2">{items.map(([key,label])=><label key={key}>{label}<input disabled={locked} value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}</div>}
 return <section aria-label="Prepare exact ECS proposal" aria-busy={busy} className="rounded-xl border border-white/10 p-5 space-y-5">
  <header><h2 className="text-lg font-medium">Prepare one exact ECS change</h2><p className="mt-2 text-sm text-zinc-400">Identify the target and a workflow run that already exists. Saving is a proposal, not approval, delegation, workflow dispatch or credential issuance. Current source qualification is required on the server.</p></header>
  {!current&&<p role="alert">Account context changed. Preserve the original reference and reopen this workflow.</p>}
  <label>Deployment operation<select disabled={locked} value={operation} onChange={e=>{if(e.target.value==='force'||e.target.value==='rollback')setOperation(e.target.value)}}><option value="force">Roll out exact task definition</option><option value="rollback">Separately reviewed conditional rollback</option></select></label>
  <fieldset className="space-y-3"><legend className="font-medium">Deployment target</legend>{fields(targetFields)}</fieldset>
  <fieldset className="space-y-3"><legend className="font-medium">Already-created workflow run</legend>{fields(runFields)}<p className="text-xs text-zinc-400">Fixed source: refs/heads/main · .github/workflows/axiom-deploy-aws-ecs.yml. The run stays subject to native protection and exact-run authentication; these entered fields are not proof.</p></fieldset>
  <label>Review expiry (UTC ISO)<input disabled={locked} value={values.expiresAt} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" onChange={e=>setValues(v=>({...v,expiresAt:e.target.value}))}/></label>
  <details><summary>Reviewed source and issuer references</summary><div className="mt-3 space-y-3">{fields(evidenceFields)}<p className="text-xs text-zinc-400">Enter nonsecret references only, never a token or credential. These are requested metadata; source hashes and receipt IDs do not grant execution authority.</p></div></details>
  {operation==='rollback'&&<fieldset className="space-y-3"><legend className="font-medium">Original terminal-failure lineage</legend>{fields(failureFields)}<p className="text-sm text-zinc-400">Native failure, the prior deployment and safe credential closure need current qualified evidence. A lost response or timeout never authorizes rollback. Nothing rolls back automatically.</p></fieldset>}
  {!reference?<>
   <button type="button" className="btn-secondary" disabled={locked} onClick={keep}>Keep ECS proposal reference</button>
   <details><summary>Recover an existing proposal</summary><label>Existing ECS request reference<input disabled={!current||busy} value={existing} onChange={e=>setExisting(e.target.value)}/></label><button type="button" className="btn-secondary" disabled={!current||busy} onClick={recover}>Recover existing ECS reference</button></details>
  </>:<>
   <label>Original ECS request reference<input readOnly value={reference.requestId}/></label>
   <div className="flex flex-wrap gap-3">{!submitted&&<button type="button" className="btn-secondary" disabled={!current||busy||!canPrepare} onClick={()=>{if(owns()&&!running.current&&!held.current){original.current=null;setReference(null);setMessage('Unsent selection reopened. Nothing was submitted.')}}}>Edit unsent ECS selection</button>}<button type="button" className="btn-primary" disabled={!current||busy||!canPrepare||submitted||!reference.selection} onClick={()=>void run('save')}>Save ECS proposal only</button><button type="button" className="btn-secondary" disabled={!current||busy} onClick={()=>void run('lookup')}>Look up original ECS reference</button></div>
  </>}
  {savedAction&&<label>Saved ECS action reference<input readOnly value={savedAction}/></label>}
  <p role="status" aria-live="polite">{busy?'Checking the original ECS proposal…':message}</p>
 </section>;
}
