import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from "react";
import {desktopClient} from "../lib/desktopClient";
import {isCustomerPlanProfileView} from "../lib/terraformCustomerPlanContract";
import type {DesktopAwsAccount} from "../lib/awsEnrollmentContract";
import type {CustomerPlanConfigurationInput,CustomerPlanProfileView} from "../../../lib/terraform/customerPlanDto";
import type {CustomerPlanProfile} from "../../../lib/terraform/customerPlanTypes";
const unavailable="Customer plan storage or the reviewed producer is unavailable. Ask a workspace administrator to review storage, the protected CI profile and connected read access. Approval and apply remain unavailable.";
const immutable="Create a new deployment request for a different environment. This profile's environment is immutable.";
const labels={repositoryRemoteId:"Public GitHub repository ID",sourceRef:"Exact source ref",sourceSha:"Exact source commit SHA",workflowPath:"Reviewed workflow path",workflowDigest:"Reviewed workflow SHA-256",scriptPath:"Reviewed producer script path",scriptDigest:"Reviewed producer script SHA-256",trustProfileId:"Reviewed trust profile ID",toolchainProfileId:"Reviewed toolchain profile ID",planRoleArn:"Separate customer CI plan role ARN",root:"Canonical JSON configuration root",treeDigest:"Configuration tree digest",providerLockDigest:"Reviewed provider lock SHA-256",region:"AWS region",stateBucket:"Existing state bucket",stateKey:"Existing state key",lockTable:"Existing DynamoDB lock table",artifactBucket:"Existing private artifact bucket",artifactPrefix:"Fixed artifact prefix",kmsKeyArn:"Artifact encryption KMS key ARN"} as const;
type Fields=Record<keyof typeof labels|"environmentId"|"repositoryRecordId"|"connectionId",string>;
type Catalogs={environments:Array<{id:string;name:string}>;repositories:Array<{id:string;displayName:string;remoteUrl:string}>;accounts:DesktopAwsAccount[]};
const blank=():Fields=>Object.fromEntries([...Object.keys(labels),"environmentId","repositoryRecordId","connectionId"].map(key=>[key,""])) as Fields;
function fromProfile(p:CustomerPlanProfile|null):Fields{return !p?blank():{environmentId:p.environmentId,repositoryRecordId:p.repository.recordId,repositoryRemoteId:p.repository.remoteId,sourceRef:p.repository.sourceRef,sourceSha:p.repository.sourceSha,workflowPath:p.producer.workflowPath,workflowDigest:p.producer.workflowDigest,scriptPath:p.producer.scriptPath,scriptDigest:p.producer.scriptDigest,trustProfileId:p.producer.trustProfileId,toolchainProfileId:p.producer.toolchainProfileId,planRoleArn:p.producer.planRoleArn,root:p.configuration.root,treeDigest:p.configuration.treeDigest,providerLockDigest:p.configuration.providerLockDigest,region:p.backend.region,stateBucket:p.backend.bucket,stateKey:p.backend.key,lockTable:p.backend.lockTable,artifactBucket:p.artifacts.bucket,artifactPrefix:p.artifacts.prefix,kmsKeyArn:p.artifacts.kmsKeyArn,connectionId:p.connection.id};}
function repositoryName(url:string):string|null{try{const value=new URL(url);if(value.protocol!=="https:"||value.hostname!=="github.com"||value.username||value.password||value.port||value.search||value.hash)return null;const name=value.pathname.replace(/^\//,"").replace(/\/$/,"").replace(/\.git$/,"");return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)?name:null;}catch{return null;}}
function configuration(f:Fields,fullName:string):CustomerPlanConfigurationInput{return {environmentId:f.environmentId,repository:{recordId:f.repositoryRecordId,remoteId:f.repositoryRemoteId,fullName,sourceRef:f.sourceRef,sourceSha:f.sourceSha},producer:{workflowPath:f.workflowPath,workflowSha:f.sourceSha,workflowDigest:f.workflowDigest,scriptPath:f.scriptPath,scriptDigest:f.scriptDigest,trustProfileId:f.trustProfileId,toolchainProfileId:f.toolchainProfileId,planRoleArn:f.planRoleArn},configuration:{root:f.root,treeDigest:f.treeDigest,providerLockDigest:f.providerLockDigest},backend:{region:f.region,bucket:f.stateBucket,key:f.stateKey,lockTable:f.lockTable},artifacts:{bucket:f.artifactBucket,region:f.region,prefix:f.artifactPrefix,kmsKeyArn:f.kmsKeyArn},connection:{id:f.connectionId}};}
/** Selected-request policy/import UI only. It never runs CI, Terraform or apply.
 * Every async result is bound to request/version and the paired context revision. */
export function TerraformCustomerPlanProfile({requestId,requestVersion,onEvidenceInvalidated,onImported}:{requestId:string;requestVersion:number;onEvidenceInvalidated:()=>void;onImported:(artifactId:string)=>void}){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),key=`${revision}:${requestId}:${requestVersion}`,active=useRef(key),attempt=useRef(0);
 useLayoutEffect(()=>{active.current=key;attempt.current+=1;},[key]);useEffect(()=>()=>{attempt.current+=1;},[]);
 const [state,setState]=useState<{key:string;busy:boolean;view?:CustomerPlanProfileView;catalogs?:Catalogs;error?:string;notice?:string}>({key,busy:false}),[fields,setFields]=useState<Fields>(blank),[runId,setRunId]=useState(""),[runAttempt,setRunAttempt]=useState("1");
 const current=state.key===key?state:{key,busy:false},view=current.view,profile=view?.profile,dirty=!!view&&JSON.stringify(fields)!==JSON.stringify(fromProfile(profile??null));
 function begin(){const token={key,attempt:++attempt.current,revision:desktopClient.getContextRevision()};onEvidenceInvalidated();return ()=>active.current===token.key&&attempt.current===token.attempt&&desktopClient.getContextRevision()===token.revision;}
 async function load(){
  const valid=begin();setState({key,busy:true});setFields(blank());setRunId("");setRunAttempt("1");
  try{
   const result=await desktopClient.getDeploymentTerraformProfile(requestId);if(!valid())return;
   if(!result.ok||!isCustomerPlanProfileView(result.data,requestId)){setState({key,busy:false,error:unavailable});return;}
   const next=result.data;setFields(fromProfile(next.profile));
   if(!next.permissions.configure){setState({key,busy:false,view:next});return;}
   const [environments,repositories,accounts]=await Promise.all([desktopClient.listEnvironments(),desktopClient.listRepositories(),desktopClient.desktopCloudAccounts()]);if(!valid())return;
   const catalogs=environments.ok&&repositories.ok&&accounts.ok?{environments:environments.data.environments,repositories:repositories.data.repositories.filter(repo=>repo.provider==="github"&&repositoryName(repo.remoteUrl)!==null),accounts:accounts.data.accounts}:undefined;
   setState({key,busy:false,view:next,catalogs,...(!catalogs?{error:unavailable}:{})});
  }catch{if(valid())setState({key,busy:false,error:unavailable});}
 }
 async function write(mode:"configure"|"revoke"|"import"){
  if(!view)return;const valid=begin(),p=view.profile,captured=structuredClone(fields),catalogs=current.catalogs;setState({...current,key,busy:true,error:undefined,notice:undefined});
  try{
   if(mode==="import"){
    if(!p||view.status!=="active"||p.requestVersion!==requestVersion||!view.permissions.import||!view.profileExport||dirty||!/^\d+$/.test(runId)||!Number.isSafeInteger(Number(runAttempt))||Number(runAttempt)<1)throw Error("unavailable");
    const result=await desktopClient.importDeploymentTerraformPlan(requestId,{requestVersion,profileId:p.id,profileRevision:p.revision,runId,runAttempt:Number(runAttempt)});if(!valid())return;
    if(!result.ok){setState({...current,key,busy:false,error:unavailable});return;}setRunId("");setState({...current,key,busy:false,notice:"Imported review evidence. Approval and apply remain unavailable."});onImported(result.data.artifactId);return;
   }
   if(!view.permissions.configure||mode==="revoke"&&!p)throw Error("unavailable");
   const repository=catalogs?.repositories.find(repo=>repo.id===captured.repositoryRecordId),fullName=repository&&repositoryName(repository.remoteUrl);
   if(mode==="configure"&&(!catalogs||!fullName||!catalogs.environments.some(e=>e.id===captured.environmentId)||!catalogs.accounts.some(a=>a.id===captured.connectionId&&a.connected&&a.regions.includes(captured.region))||Object.values(captured).some(value=>!value)))throw Error("unavailable");
   const result=mode==="revoke"?await desktopClient.revokeDeploymentTerraformProfile(requestId,{requestVersion,profileId:p!.id,expectedRevision:p!.revision}):await desktopClient.configureDeploymentTerraformProfile(requestId,{requestVersion,expectedRevision:p?.revision??0,profileInput:configuration(captured,fullName!)});if(!valid())return;
   if(!result.ok||!isCustomerPlanProfileView(result.data,requestId)){setState({...current,key,busy:false,error:!result.ok&&result.error==="customer_plan_environment_immutable_new_request"?immutable:unavailable});return;}
   setFields(fromProfile(result.data.profile));setRunId("");setState({key,busy:false,view:result.data,catalogs,notice:mode==="revoke"?"Profile revoked locally. Provider grants and issued sessions were not revoked.":"Saved review profile. Read the profile again to obtain its fresh protected CI export."});
  }catch{if(valid())setState({...current,key,busy:false,error:unavailable});}
 }
 const catalog=current.catalogs,repository=catalog?.repositories.find(repo=>repo.id===fields.repositoryRecordId),account=catalog?.accounts.find(a=>a.id===fields.connectionId);
 const canSave=!!catalog&&Object.values(fields).every(Boolean)&&catalog.environments.some(e=>e.id===fields.environmentId)&&!!repository&&!!repositoryName(repository.remoteUrl)&&!!account?.connected&&account.regions.includes(fields.region);
 function change(name:keyof Fields,value:string){onEvidenceInvalidated();setRunId("");setFields(f=>({...f,[name]:value}));}
 return <section aria-label="Customer Terraform review profile" className="mt-5 border-t border-white/10 pt-4">
  <h4 className="font-semibold text-white">Customer CI plan evidence</h4>
  <p className="mt-2">A separately authorized protected customer CI job creates the saved plan from reviewed canonical JSON configuration. Axiom imports exact signed plan evidence; it does not start CI or Terraform here.</p>
  <button type="button" className="btn-secondary mt-3 disabled:opacity-50" disabled={current.busy} onClick={()=>void load()}>{current.busy?"Reviewing customer evidence…":"Read customer plan profile"}</button>
  {current.error&&<p role="alert" className="mt-3 text-rose-300">{current.error}</p>}{current.notice&&<p role="status" className="mt-3">{current.notice}</p>}
  {view&&<>
   <p className="mt-3">Profile status: {view.status}. Current target is unavailable until a separate fresh observation. Approval and execution are unavailable.</p>
   {profile&&<p>Profile configuration remains bound to request version {profile.requestVersion} · revision {profile.revision}.</p>}
   {!view.permissions.configure&&<p className="mt-2">Current role can read evidence. A current workspace owner or admin must configure or import it.</p>}
   {view.permissions.configure&&<>
    <form aria-label="Customer Terraform profile configuration" onSubmit={event=>{event.preventDefault();void write("configure");}}>
     <fieldset disabled={current.busy} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label>Environment<select aria-label="Environment" className="input mt-1 w-full" disabled={!!profile} value={fields.environmentId} onChange={e=>change("environmentId",e.target.value)}><option value="">Select the request environment</option>{profile&&!catalog?.environments.some(e=>e.id===profile.environmentId)&&<option value={profile.environmentId}>Saved environment {profile.environmentId} (not in current catalog)</option>}{catalog?.environments.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <label>Canonical repository<select aria-label="Canonical repository" className="input mt-1 w-full" value={fields.repositoryRecordId} onChange={e=>{onEvidenceInvalidated();setRunId("");setFields(f=>({...f,repositoryRecordId:e.target.value,repositoryRemoteId:"",sourceRef:"",sourceSha:"",workflowPath:"",workflowDigest:"",scriptPath:"",scriptDigest:"",root:"",treeDigest:"",providerLockDigest:""}));}}><option value="">Select the request repository</option>{catalog?.repositories.map(r=><option key={r.id} value={r.id}>{r.displayName}</option>)}</select></label>
      <label>Observed AWS connection<select aria-label="Observed AWS connection" className="input mt-1 w-full" value={fields.connectionId} onChange={e=>change("connectionId",e.target.value)}><option value="">Select existing read connection</option>{catalog?.accounts.map(a=><option key={a.id} value={a.id} disabled={!a.connected}>{a.alias??a.accountId} · {a.status}</option>)}</select></label>
      {Object.entries(labels).map(([name,label])=><label key={name}>{label}<input required autoComplete="off" spellCheck={false} aria-label={label} className="input mt-1 w-full" value={fields[name as keyof Fields]} onChange={e=>change(name as keyof Fields,e.target.value)}/></label>)}
     </fieldset>
     {profile&&<p className="mt-2">{immutable}</p>}
     <p className="mt-2">Connection identity is read-only observation, not a CI plan role or apply permission. Existing S3 versioning, default workspace, DynamoDB locking and artifact KMS permissions need separate customer review.</p>
     <button type="submit" className="btn-secondary mt-3 disabled:opacity-50" disabled={current.busy||!canSave}>Save review profile</button>
    </form>
    {profile&&view.status!=="revoked"&&<button type="button" className="btn-secondary mt-3 disabled:opacity-50" disabled={current.busy} onClick={()=>void write("revoke")}>Revoke profile locally</button>}
   </>}
   {view.profileExport&&!dirty&&!current.busy&&profile?.requestVersion===requestVersion&&<details className="mt-3"><summary>Protected CI profile export</summary><p className="mt-2">Save this server-bound profile export for the separately reviewed manual CI job. It contains configuration identity, not cloud credentials or an execution permit.</p><textarea aria-label="Protected CI profile export" readOnly className="input mt-2 w-full" rows={8} value={JSON.stringify(view.profileExport,null,2)}/></details>}
   {view.permissions.import&&view.status==="active"&&profile?.requestVersion===requestVersion&&view.profileExport&&<form aria-label="Import completed customer Terraform evidence" className="mt-4" onSubmit={event=>{event.preventDefault();void write("import");}}><fieldset disabled={current.busy||dirty} className="flex flex-wrap items-end gap-3"><label>Completed CI run ID<input required inputMode="numeric" pattern="[1-9][0-9]*" aria-label="Completed CI run ID" className="input mt-1 block" value={runId} onChange={e=>setRunId(e.target.value)}/></label><label>CI run attempt<input required type="number" min={1} max={2147483647} aria-label="CI run attempt" className="input mt-1 block" value={runAttempt} onChange={e=>setRunAttempt(e.target.value)}/></label><button type="submit" className="btn-secondary disabled:opacity-50" disabled={current.busy||dirty||!runId}>Import completed CI plan</button></fieldset>{dirty&&<p className="mt-2">Save and reread the revised profile before importing evidence.</p>}</form>}
  </>}
 </section>;
}
