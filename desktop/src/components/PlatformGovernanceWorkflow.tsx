import {CustodianPreparationPanel} from './CustodianPreparationPanel';
import {CustodianControlPanel} from './CustodianControlPanel';
import {CustodianHistoryPanel} from './CustodianHistoryPanel';
import type {CustodianClient} from '../lib/custodian';
import {OperationalManualReleasePanel} from './OperationalManualReleasePanel';
import type {ManualReleaseClient} from '../lib/manualRelease';
import {OperationalSettingsExecutionPanel} from './OperationalSettingsExecutionPanel';
import type {SettingsExecutionClient} from '../lib/settingsReview';
import {OperationalSettingsArtifactPanel} from './OperationalSettingsArtifactPanel';
import type {SettingsArtifactClient} from '../lib/settingsReview';
import {OperationalSettingsHistoryPanel} from './OperationalSettingsHistoryPanel';
import type {SettingsHistoryClient} from '../lib/settingsReview';
import {OperationalSettingsReviewPanel} from './OperationalSettingsReviewPanel';
import type {SettingsReviewClient} from '../lib/settingsReview';
import {OperationalEcsHistoryPanel} from './OperationalEcsHistoryPanel';
import type {OperationalHistoryClient} from '../lib/operationalReview';
import {OperationalEcsDelegationPanel} from './OperationalEcsDelegationPanel';
import type {OperationalDelegationClient} from '../lib/operationalReview';
import {OperationalEcsReviewPanel} from './OperationalEcsReviewPanel';
import type {OperationalReviewClient} from '../lib/operationalReview';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {PlatformTemplateClient,PlatformDeploymentClient,PlatformSourceClient,PlatformReviewClient,PlatformPreparationClient,PlatformExecutionClient,createPlatformHistoryClient} from '../lib/platformReview';
import {platformActionId,platformInspectionSchema,type PlatformInspection} from '../../../lib/governance/platform/viewContract';
import {PlatformHistoryPanel} from './PlatformHistoryPanel';
import {PlatformDeploymentPreparationPanel} from './PlatformDeploymentPreparationPanel';
import {PlatformPreparationPanel} from './PlatformPreparationPanel';
import {PlatformTemplatePreparationPanel} from './PlatformTemplatePreparationPanel';
import {PlatformReviewPanel} from './PlatformReviewPanel';
import {PlatformExecutionPanel} from './PlatformExecutionPanel';
interface Props{
 currentUserId:string;canPrepare:boolean;canApprove:boolean;canExecute:boolean;
 clients:{custodian?:CustodianClient;manualRelease?:ManualReleaseClient;settingsExecution?:SettingsExecutionClient;settingsArtifact?:SettingsArtifactClient;settingsHistory?:SettingsHistoryClient;settings?:SettingsReviewClient;operationalHistory?:OperationalHistoryClient;operationalDelegation?:OperationalDelegationClient;operational?:OperationalReviewClient;template?:Pick<PlatformTemplateClient,'preview'>&Partial<Pick<PlatformTemplateClient,'prepare'|'lookup'>>;deployment?:PlatformDeploymentClient;sources?:PlatformSourceClient;review:PlatformReviewClient;preparation:PlatformPreparationClient;execution:PlatformExecutionClient;history:ReturnType<typeof createPlatformHistoryClient>};
}
function sameLineage(previous:PlatformInspection,next:PlatformInspection){
 return next.actionId===previous.actionId&&JSON.stringify(next.plan)===JSON.stringify(previous.plan)&&next.requesterUserId===previous.requesterUserId&&(!previous.reviewerUserId||next.reviewerUserId===previous.reviewerUserId)&&next.version>=previous.version&&(next.version!==previous.version||next.status===previous.status&&JSON.stringify(next.effects)===JSON.stringify(previous.effects));
}
/** Prepared integration, NOT a registered product entry point. Capability
 * props are presentation hints only; server authority always decides. */
export function PlatformGovernanceWorkflow({currentUserId,canPrepare,canApprove,canExecute,clients}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config,userId:currentUserId}).current;
 const [delegationKnown,setDelegationKnown]=useState<string|null>(null);
 const [reference,setReference]=useState(''),[action,setAction]=useState<PlatformInspection|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(true),generation=useRef(0),active=useRef<AbortController|null>(null);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config&&currentUserId===owner.userId;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 async function load(id:string){
  if(!owns())return;const parsed=platformActionId.safeParse(id);if(!parsed.success){setMessage('Enter the original saved action reference.');return}
  active.current?.abort();const sequence=++generation.current,c=new AbortController();active.current=c;setReference(parsed.data);setBusy(true);setAction(null);setMessage('');
  try{const response=await clients.review.inspect(parsed.data,c.signal);if(!owns()||sequence!==generation.current)return;
   if(!response.ok)throw Error('unavailable');const saved=platformInspectionSchema.safeParse(response.data);if(!saved.success||saved.data.actionId!==parsed.data||action?.actionId===parsed.data&&!sameLineage(action,saved.data))throw Error('mismatched');setAction(saved.data);
  }catch{if(owns()&&sequence===generation.current)setMessage('The saved record is unavailable. Keep the original reference; no approval or execution was submitted.')}
  finally{if(owns()&&sequence===generation.current)setBusy(false)}
 }
 function recorded(raw:PlatformInspection){
  if(!owns()||!action)return;const saved=platformInspectionSchema.safeParse(raw);
  if(!saved.success||!sameLineage(action,saved.data)){setMessage('The response does not match the selected saved action. Inspect the original record.');return}setAction(saved.data);
 }
 const current=revision===owner.revision&&owns(),requester=action?.requesterUserId===currentUserId;
 const first=action?.plan.effects[0],custodianControl=action?.plan.effects.length===1&&first?.kind==='custodian.drain'&&Boolean(clients.custodian),settingsReview=Boolean(action&&action.plan.effects.every(effect=>effect.kind==='settings.vercel')&&clients.settings),ecsDelegation=action?.plan.effects.length===1&&first?.kind==='deployment.ecs'&&Boolean(clients.operationalDelegation),ecsReview=action?.plan.effects.length===1&&first?.kind==='deployment.ecs'&&Boolean(clients.operational),growthSupported=action?.plan.effects.length===1&&Boolean(first&&['growth.post.publish','growth.schedule.change','growth.post.delete'].includes(first.kind)),deploymentReview=action?.plan.effects.length===1&&first?.kind==='deployment.vercel'&&Boolean(first.target.leadId)&&Boolean(first.target.leadRevision)&&Boolean(clients.deployment),templateReview=action?.plan.effects.length===1&&Boolean(first&&(first.kind==='template.bucket.create'||first.kind==='template.object.put'||first.kind==='template.access.grant'))&&Boolean(clients.template);
 function nextStep(){
  if(!action)return 'Prepare an exact proposal or load a saved action. Nothing executes on this screen automatically.';
  if(custodianControl)return ['proposed','approved'].includes(action.status)?'Inspect the exact issuer control. Independent approval and original-requester execution are separate; neither proves credential closure.':'Inspect original control and closure history. Do not replay consumed controls; provider outcomes remain separate.';
  if(action.status==='confirmed')return 'The recorded action is confirmed. Inspect its evidence; this record cannot execute again.';
  if(action.status==='claimed'&&action.plan.effects.every(effect=>effect.kind==='settings.vercel')&&clients.settingsExecution&&clients.settingsHistory)return 'Inspect original targets and results. Only a confirmed earlier setting permits a separate next command; unknown or in-flight work must not be repeated.';
  if(['claimed','unknown'].includes(action.status))return 'The attempt is consumed and needs inspection. Do not resend or create a replacement.';
  if(action.status==='refused')return 'The recorded attempt was refused. Inspect its evidence; do not reset or resend it.';
  if(action.expired||Date.now()>=Date.parse(action.plan.expiresAt))return 'This review window has expired. Historical approval does not authorize an action.';
  if(action.status==='proposed'&&!growthSupported&&!deploymentReview&&!templateReview&&!ecsReview&&!settingsReview)return 'Source review for this operation is not available yet. Its saved history remains inspectable.';
  if(action.status==='approved'&&requester&&ecsDelegation)return delegationKnown===action.actionId?'Delegation is recorded for the exact run. Workload authentication and qualified execution remain required; nothing starts here.':'Inspect the approved run and explicitly confirm only its delegation. This does not start a workflow or deployment.';
  if(action.status==='approved'&&action.plan.effects.every(effect=>effect.kind==='settings.vercel')&&clients.settingsExecution&&clients.settingsHistory)return 'Inspect the exact approved targets, then explicitly claim the original action. Claiming does not send a setting.';
  if(action.status==='approved'&&!growthSupported)return 'Independent decision is recorded. Execution for this operation is not available in this prepared workflow.';
  if(action.status==='proposed')return requester?'Ask another authorized person to inspect this exact source and record an independent decision.':'Load the exact source and record your own independent decision. No operation is executed by approval.';
  return requester?'Inspect the approved source and explicitly confirm one execution. The server rechecks current permissions.':'The original requester must execute separately in the original authorized session. Your approval does not execute it.';
 }
 return <main aria-label="Platform operation workflow" className="mx-auto max-w-5xl space-y-6 p-6">
  <header><p className="text-xs uppercase tracking-wider text-zinc-400">Platform operations · local preparation</p><h1 className="mt-2 text-2xl font-semibold">One exact change, a clear record</h1><p className="mt-2 text-sm text-zinc-400">Prepared growth actions, generated-site files, exact template source and independently reviewed ECS proposals. Deployment execution, template and image workflow coverage remain incomplete; production activation is unavailable.</p></header>
  {!current?<p role="alert">Account context changed. Reopen this workflow in the current session. Prior approvals and attempts were not renewed.</p>:<>
   <aside aria-label="Next step" className="rounded-xl border border-white/10 p-4">{nextStep()}</aside>
   {clients.custodian&&<details><summary>Prepare or recover an issuer control</summary><CustodianPreparationPanel client={clients.custodian} canPrepare={canPrepare} onSaved={id=>void load(id)}/></details>}
   {clients.manualRelease&&<details><summary>Review a manual production release</summary><OperationalManualReleasePanel client={clients.manualRelease} currentUserId={currentUserId} canApprove={canApprove} canRecordNotice={canExecute}/></details>}
   {clients.template?.prepare&&clients.template.lookup&&<details><summary>Prepare a template proposal</summary><PlatformTemplatePreparationPanel client={{prepare:clients.template.prepare,lookup:clients.template.lookup}} canPrepare={canPrepare} onSaved={id=>void load(id)}/></details>}
   {clients.deployment&&<details><summary>Prepare a generated-site deployment proposal</summary><PlatformDeploymentPreparationPanel sourceClient={clients.sources} client={clients.deployment} canPrepare={canPrepare} onSaved={id=>void load(id)}/></details>}
   <details><summary>Prepare a growth proposal</summary><PlatformPreparationPanel sourceClient={clients.sources} client={clients.preparation} canPrepare={canPrepare} onSaved={id=>void load(id)}/></details>
   <details><summary>Find older saved actions</summary><PlatformHistoryPanel client={clients.history} onSelect={id=>void load(id)}/></details>
   <section className="space-y-3" aria-label="Load saved action"><label>Saved action reference<input value={reference} disabled={busy} onChange={e=>setReference(e.target.value)}/></label><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void load(reference)}>Load this saved record</button></section>
   {action&&custodianControl&&clients.custodian&&<CustodianHistoryPanel key={action.actionId+':custodian-history'} actionId={action.actionId} currentUserId={currentUserId} client={clients.custodian} canObserve={canExecute}/>}
   {action&&action.plan.effects.every(effect=>effect.kind==='settings.vercel')&&action.attemptCount===1&&clients.settingsHistory&&<OperationalSettingsHistoryPanel key={action.actionId+':settings-history'} actionId={action.actionId} planDigest={action.plan.digest} currentUserId={currentUserId} client={clients.settingsHistory}/>}
   {action&&first?.kind==='deployment.ecs'&&action.attemptCount===1&&clients.operationalHistory&&<OperationalEcsHistoryPanel key={action.actionId+':history'} actionId={action.actionId} currentUserId={currentUserId} client={clients.operationalHistory}/>}
   {action&&custodianControl&&clients.custodian?(['proposed','approved'].includes(action.status)?<CustodianControlPanel key={action.actionId+':custodian-control'} actionId={action.actionId} currentUserId={currentUserId} canApprove={canApprove} canExecute={canExecute} client={clients.custodian}/>:null):action&&action.plan.effects.every(effect=>effect.kind==='settings.vercel')&&clients.settingsHistory&&clients.settingsExecution&&requester&&['approved','claimed'].includes(action.status)?<OperationalSettingsExecutionPanel key={action.actionId+':settings-execution:'+action.version} action={action} currentUserId={currentUserId} canExecute={canExecute} reader={clients.settingsHistory} client={clients.settingsExecution} onRecorded={()=>void load(action.actionId)}/>:action&&settingsReview&&clients.settings&&clients.settingsArtifact&&requester&&action.status==='proposed'?<OperationalSettingsArtifactPanel key={action.actionId+':artifacts'} actionId={action.actionId} planDigest={action.plan.digest} requesterUserId={action.requesterUserId} currentUserId={currentUserId} canPrepare={canPrepare} reader={clients.settings} client={clients.settingsArtifact}/>:action&&settingsReview&&clients.settings&&action.status==='proposed'?<OperationalSettingsReviewPanel key={action.actionId+':settings:'+action.version} actionId={action.actionId} planDigest={action.plan.digest} requesterUserId={action.requesterUserId} currentUserId={currentUserId} canApprove={canApprove} client={clients.settings} onRecorded={()=>void load(action.actionId)}/>:action&&ecsDelegation&&clients.operationalDelegation&&requester&&action.status==='approved'?<OperationalEcsDelegationPanel key={action.actionId+':delegation'} actionId={action.actionId} currentUserId={currentUserId} canDelegate={canExecute} client={clients.operationalDelegation} onDelegationKnown={known=>{if(owns())setDelegationKnown(known?action.actionId:null)}}/>:action&&ecsReview&&clients.operational&&['proposed','approved'].includes(action.status)?<OperationalEcsReviewPanel key={action.actionId+':'+action.version} actionId={action.actionId} currentUserId={currentUserId} canApprove={canApprove} client={clients.operational} onRecorded={()=>void load(action.actionId)}/>:action&&(requester&&action.status!=='proposed'&&growthSupported?<PlatformExecutionPanel action={action} currentUserId={currentUserId} canExecute={canExecute} client={clients.execution} onRecorded={recorded}/>:<PlatformReviewPanel templateClient={clients.template} deploymentClient={clients.deployment} action={action} currentUserId={currentUserId} canApprove={canApprove} client={clients.review} onRecorded={recorded}/>)}
  </>}
  <p role="status" aria-live="polite">{busy?'Loading the original saved action…':message}</p>
 </main>;
}
