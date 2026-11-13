import {z} from 'zod';
import {imageWorkflowCommand,imageWorkflowPreview,imageWorkflowHistory,imageArtifactIntakeResult,imageArtifactLookupResult,imagePreparedResult,imageActionLookupResult} from '../../../lib/governance/platform/imageWorkflowContract';
import {platformActionId,type PlatformInspection} from '../../../lib/governance/platform/viewContract';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
type Context=Parameters<typeof releaseOperationPlanRequest>[0];
type Preview=z.infer<typeof imageWorkflowPreview>;
type History=z.infer<typeof imageWorkflowHistory>;
const path='/api/desktop/platform-governance/image-workflow';
const fail=(outcomeUnconfirmed=false)=>({ok:false as const,error:outcomeUnconfirmed?'Image result is unconfirmed. Read the same action or original reference; do not repeat automatically.':'Load the exact current image in the current account.',outcomeUnconfirmed});
function normalize(v:unknown):unknown{if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,c])=>[k,normalize(c)]));return v}
async function bytesHash(bytes:Uint8Array){const value=await crypto.subtle.digest('SHA-256',bytes as BufferSource);return Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,'0')).join('')}
async function hash(value:unknown){return bytesHash(new TextEncoder().encode(JSON.stringify(normalize(value))))}
function owner(c:Context,signal?:AbortSignal){const config=c.getConfig(),revision=c.getRevision(),base=config.apiBase,token=config.sessionToken;return ()=>!signal?.aborted&&c.getConfig()===config&&c.getRevision()===revision&&config.apiBase===base&&config.sessionToken===token}
function secure(c:Context){try{const u=new URL(c.getConfig().apiBase);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===c.getConfig().apiBase}catch{return false}}
function encode(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function decode(value:string){const binary=atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(binary,c=>c.charCodeAt(0))}
async function exactPlan(action:PlatformInspection){const {digest,...body}=action.plan;return digest===await hash({kind:'platform_governance_plan_v1',...body})}
async function exactHistory(value:History){if(!await exactPlan(value.action))return false;const receipt=value.upload?.grant?.result;if(!receipt)return true;const {receiptDigest,...body}=receipt;return receiptDigest===await hash(body)}
async function exactPreview(value:Preview){if(!await exactPlan(value.action))return false;const bytes=decode(value.bytesBase64url);try{return bytes.length===value.artifact.byteCount&&encode(bytes)===value.bytesBase64url&&await bytesHash(bytes)===value.artifact.bytesDigest}finally{bytes.fill(0)}}
const prepared=imagePreparedResult.extend({requestReference:z.string().uuid()}).strict();
const lookup=z.discriminatedUnion('found',[
 imageActionLookupResult.options[0].extend({requestReference:z.string().uuid()}).strict(),
 imageActionLookupResult.options[1].extend({requestReference:z.string().uuid()}).strict(),
]);
/** Prepared, not mounted. Hashes detect response mismatch; they cannot qualify a
 * codec/provider or grant approval. Exact native steps accept only a saved history snapshot; server authority remains mandatory. */
export function createImageWorkflowClient(context:Context){
 async function execute(raw:unknown,kind:'initialize'|'put',signal?:AbortSignal):Promise<ReleasePlanResult<History>>{
  const owns=owner(context,signal),p=imageWorkflowHistory.safeParse(raw);let submitted=false;
  if(!secure(context)||!p.success||!p.data.upload||p.data.action.expired||Date.parse(p.data.action.plan.expiresAt)<=Date.now())return fail();
  const previous=p.data,a=previous.action,g=previous.upload!.grant;
  if(kind==='initialize'?(a.status!=='approved'||a.version!==1||a.effects[0]?.status!=='not_started'||g!==null):(a.status!=='claimed'||a.version!==2||a.effects[0]?.status!=='confirmed'||a.effects[1]?.status!=='not_started'||!g||g.claimedAt!==null||g.result!==null||g.expiresAt<=Date.now()))return fail();
  try{
   if(!await exactHistory(previous)||!owns())return fail();const command=imageWorkflowCommand.parse({operation:kind,actionId:a.actionId,expectedVersion:kind==='initialize'?1:2,planDigest:a.plan.digest});submitted=true;
   const result=await releaseOperationPlanRequest(context,'POST',path,command,(raw):raw is History=>{
    const v=imageWorkflowHistory.safeParse(raw);if(!v.success||!v.data.upload)return false;
    const next=v.data.action,upload=v.data.upload;
    return next.actionId===a.actionId&&next.plan.digest===a.plan.digest&&next.requesterUserId===a.requesterUserId&&next.reviewerUserId===a.reviewerUserId&&upload.bindingDigest===previous.upload!.bindingDigest&&JSON.stringify(normalize(upload.artifact))===JSON.stringify(normalize(previous.upload!.artifact))&&(kind==='initialize'?next.status==='claimed'&&next.version===2&&next.effects[0]?.status==='confirmed'&&upload.grant!==null:next.status==='confirmed'&&next.version===3&&Boolean(upload.grant?.result?.ready));
   },signal);
   if(!result.ok)return result;return await exactHistory(result.data)&&owns()?result:fail(true);
  }catch{return fail(submitted)}
 }
 return {
  initialize:(history:unknown,signal?:AbortSignal)=>execute(history,'initialize',signal),
  put:(history:unknown,signal?:AbortSignal)=>execute(history,'put',signal),
  async intake(connectionId:string,mimeType:'image/png'|'image/jpeg',input:Uint8Array,requestReference:string,signal?:AbortSignal){
   const owns=owner(context,signal);if(!secure(context)||!(input instanceof Uint8Array)||input.length<1||input.length>2097152)return fail();
   const copy=new Uint8Array(input);let submitted=false;
   try{const digest=await bytesHash(copy),c=imageWorkflowCommand.safeParse({operation:'intake',connectionId,mimeType,requestReference,bytesBase64url:encode(copy)});if(!c.success||!owns())return fail();submitted=true;
    const result=await releaseOperationPlanRequest(context,'POST',path,c.data,(raw):raw is z.infer<typeof imageArtifactIntakeResult>=>{const v=imageArtifactIntakeResult.safeParse(raw);return v.success&&v.data.requestReference===requestReference&&v.data.artifact.connectionId===connectionId&&v.data.artifact.mimeType===mimeType&&v.data.artifact.byteCount===copy.length&&v.data.artifact.bytesDigest===digest},signal);
    return owns()?result:fail(submitted);
   }catch{return fail(submitted)}finally{copy.fill(0)}
  },
  async lookupArtifact(requestReference:string,signal?:AbortSignal){const c=imageWorkflowCommand.safeParse({operation:'lookup_artifact',requestReference});if(!secure(context)||!c.success)return fail();return releaseOperationPlanRequest(context,'POST',path,c.data,(raw):raw is z.infer<typeof imageArtifactLookupResult>=>{const v=imageArtifactLookupResult.safeParse(raw);return v.success&&v.data.requestReference===requestReference},signal)},
  async prepare(artifactId:string,expiresAt:string,requestReference:string,signal?:AbortSignal){const c=imageWorkflowCommand.safeParse({operation:'prepare',artifactId,expiresAt,requestReference});if(!secure(context)||!c.success||Date.parse(expiresAt)<=Date.now())return fail();return releaseOperationPlanRequest(context,'POST',path,c.data,(raw):raw is z.infer<typeof prepared>=>{const v=prepared.safeParse(raw);return v.success&&v.data.requestReference===requestReference},signal)},
  async lookup(requestReference:string,signal?:AbortSignal){const c=imageWorkflowCommand.safeParse({operation:'lookup',requestReference});if(!secure(context)||!c.success)return fail();return releaseOperationPlanRequest(context,'POST',path,c.data,(raw):raw is z.infer<typeof lookup>=>{const v=lookup.safeParse(raw);return v.success&&v.data.requestReference===requestReference},signal)},
  async preview(id:string,signal?:AbortSignal):Promise<ReleasePlanResult<Preview>>{
   const owns=owner(context,signal);if(!secure(context)||!platformActionId.safeParse(id).success)return fail();
   const result=await releaseOperationPlanRequest(context,'POST',path,{operation:'preview',actionId:id},(raw):raw is Preview=>{const v=imageWorkflowPreview.safeParse(raw);return v.success&&v.data.action.actionId===id},signal);if(!result.ok)return result;
   try{return await exactPreview(result.data)&&Date.parse(result.data.action.plan.expiresAt)>Date.now()&&owns()?result:fail()}catch{return fail()}
  },
  async inspect(id:string,signal?:AbortSignal):Promise<ReleasePlanResult<History>>{
   const owns=owner(context,signal);if(!secure(context)||!platformActionId.safeParse(id).success)return fail();
   const result=await releaseOperationPlanRequest(context,'POST',path,{operation:'inspect',actionId:id},(raw):raw is History=>{const v=imageWorkflowHistory.safeParse(raw);return v.success&&v.data.action.actionId===id},signal);if(!result.ok)return result;
   try{return await exactHistory(result.data)&&owns()?result:fail()}catch{return fail()}
  },
  async review(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<History>>{
   const owns=owner(context,signal),p=imageWorkflowPreview.safeParse(raw);if(!secure(context)||!p.success||p.data.action.status!=='proposed'||Date.parse(p.data.action.plan.expiresAt)<=Date.now())return fail();let submitted=false;
   try{if(!await exactPreview(p.data)||!owns())return fail();const action=p.data.action;submitted=true;
    const result=await releaseOperationPlanRequest(context,'POST',path,{operation:'review',actionId:action.actionId,expectedVersion:0,planDigest:action.plan.digest},(raw):raw is History=>{const v=imageWorkflowHistory.safeParse(raw);return v.success&&v.data.action.actionId===action.actionId&&v.data.action.plan.digest===action.plan.digest&&v.data.action.requesterUserId===action.requesterUserId&&v.data.action.status==='approved'},signal);if(!result.ok)return result;
    return await exactPlan(result.data.action)&&owns()?result:fail(true);
   }catch{return fail(submitted)}
  },
 };
}
export type ImageWorkflowClient=ReturnType<typeof createImageWorkflowClient>;
