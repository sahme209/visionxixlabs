import {deploymentRecoveryCommand} from '../../../lib/governance/platform/deploymentRecoveryCommand';
import {deploymentRecoveryPreview,deploymentRecoveryHistory,deploymentRecoveryPlanInput,deploymentRecoveryPreparationReceipt,deploymentRecoveryLookup,deploymentRecoveryReviewReceipt,deploymentRecoveryObservationReceipt,type DeploymentRecoveryPlanView,type DeploymentRecoveryPreview,type DeploymentRecoveryHistory} from '../../../lib/governance/platform/deploymentRecoveryClientContract';
import {platformActionId} from '../../../lib/governance/platform/viewContract';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
type Context=Parameters<typeof releaseOperationPlanRequest>[0];
const path='/api/desktop/platform-governance/deployment-recovery';
const fail=()=>({ok:false as const,error:'Load the exact original recovery record in the current account. No decision was sent.',outcomeUnconfirmed:false});
function normalize(v:unknown):unknown{if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,c])=>[k,normalize(c)]));return v}
async function hash(v:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalize(v))));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
async function exact(p:DeploymentRecoveryPlanView,planDigest:string){const {digest,authority,executionAuthorized,...body}=p;return p.nativeKey===await hash({purpose:'platform_vercel_target_v1',...p.target})&&digest===await hash(body)&&planDigest===await hash({kind:'platform_governance_plan_v1',...deploymentRecoveryPlanInput(p)})}
function owner(c:Context,signal?:AbortSignal){const config=c.getConfig(),revision=c.getRevision(),base=config.apiBase,token=config.sessionToken;return ()=>!signal?.aborted&&c.getConfig()===config&&c.getRevision()===revision&&config.apiBase===base&&config.sessionToken===token}
/** Prepared exact-route client; no public mounting, native evidence input,
 * deployment command, automatic repeat or claim inferred from history. */
export function createDeploymentRecoveryClient(context:Context){
 async function load(operation:'preview',id:string,signal?:AbortSignal):Promise<ReleasePlanResult<DeploymentRecoveryPreview>>;
 async function load(operation:'inspect',id:string,signal?:AbortSignal):Promise<ReleasePlanResult<DeploymentRecoveryHistory>>;
 async function load(operation:'preview'|'inspect',id:string,signal?:AbortSignal){const owns=owner(context,signal);if(!platformActionId.safeParse(id).success)return fail();const schema=operation==='preview'?deploymentRecoveryPreview:deploymentRecoveryHistory;
  const result=await releaseOperationPlanRequest(context,'POST',path,{operation,actionId:id},(raw):raw is DeploymentRecoveryPreview|DeploymentRecoveryHistory=>{const p=schema.safeParse(raw);return p.success&&p.data.actionId===id},signal);if(!result.ok)return result;
  try{if(!await exact(result.data.plan,result.data.planDigest)||!owns())return fail();return result}catch{return fail()}
 }
 async function decide(operation:'review'|'observe',raw:unknown,signal?:AbortSignal){const owns=owner(context,signal),p=deploymentRecoveryPreview.safeParse(raw);if(!p.success||p.data.status!==(operation==='review'?'proposed':'approved')||Date.parse(p.data.plan.expiresAt)<=Date.now())return fail();const saved=p.data;
  try{if(!await exact(saved.plan,saved.planDigest)||!owns())return fail();const schema=operation==='review'?deploymentRecoveryReviewReceipt:deploymentRecoveryObservationReceipt;return releaseOperationPlanRequest(context,'POST',path,{operation,actionId:saved.actionId,expectedVersion:operation==='review'?0:1,planDigest:saved.planDigest},(raw):raw is import('zod').infer<typeof deploymentRecoveryReviewReceipt>|import('zod').infer<typeof deploymentRecoveryObservationReceipt>=>{const v=schema.safeParse(raw);return v.success&&v.data.actionId===saved.actionId&&v.data.planDigest===saved.planDigest},signal)}catch{return fail()}
 }
 return {
  preview:(id:string,signal?:AbortSignal)=>load('preview',id,signal),inspect:(id:string,signal?:AbortSignal)=>load('inspect',id,signal),
  review:(raw:unknown,signal?:AbortSignal)=>decide('review',raw,signal),observe:(raw:unknown,signal?:AbortSignal)=>decide('observe',raw,signal),
  async prepare(selection:unknown,requestId:string,signal?:AbortSignal){const command=deploymentRecoveryCommand.safeParse({operation:'prepare',selection,requestId});if(!command.success||command.data.operation!=='prepare'||Date.parse(command.data.selection.expiresAt)<=Date.now())return fail();return releaseOperationPlanRequest(context,'POST',path,command.data,(raw):raw is import('zod').infer<typeof deploymentRecoveryPreparationReceipt>=>{const v=deploymentRecoveryPreparationReceipt.safeParse(raw);return v.success&&v.data.requestId===requestId.toLowerCase()},signal)},
  async lookup(requestId:string,signal?:AbortSignal){const command=deploymentRecoveryCommand.safeParse({operation:'lookup',requestId});if(!command.success)return fail();return releaseOperationPlanRequest(context,'POST',path,command.data,(raw):raw is import('zod').infer<typeof deploymentRecoveryLookup>=>{const v=deploymentRecoveryLookup.safeParse(raw);return v.success&&v.data.requestId===requestId.toLowerCase()},signal)},
 };
}
export type DeploymentRecoveryClient=ReturnType<typeof createDeploymentRecoveryClient>;
