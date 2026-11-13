import {createPostImagePreviewService} from './postImagePreviewService';
import 'server-only';
import {createHash} from 'node:crypto';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import {platformActionId,platformInspectionSchema} from './viewContract';
import {assertCurrentPlatformPrincipal} from './currentAuthority';
import type {PlatformRepository,PlatformTransaction} from './actionStore';
import {readPlatformAction} from './kernel';
import {imageBindingForParent} from './imageStorageSql';
import {createImageExecutionStore,type ImageExecutionResources} from './imageExecutionStore';
import {createImageArtifactService,type ImageArtifactResources} from './imageArtifactService';
import {imageWorkflowHistory,imageWorkflowPreview,postImageWorkflowPreview,imageArtifactIntakeResult,imageArtifactLookupResult,imagePreparedResult,imageActionLookupResult} from './imageWorkflowContract';
interface RequestContext{headers:Headers;signal?:AbortSignal}
interface Ports{repo:PlatformRepository;verifyDesktopToken(token:string):{sessionId:string};readAdminEmails():readonly string[];resources?:ImageArtifactResources;executionResources?:ImageExecutionResources}
const fail=():never=>{throw Error('platform_image_workflow_unavailable')};
/** Prepared/unregistered authenticated intake/review. Real decoder/key/profile
 * resources are absent by default. There is no image execution fallback. */
export async function createImageWorkflowRequestComposition(request:RequestContext,ports:Ports){
 function session(){request.signal?.throwIfAborted();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const v=ports.verifyDesktopToken(token);if(typeof v.sessionId!=='string'||!v.sessionId||v.sessionId.length>256)return fail();return v.sessionId}catch{return fail()}}
 const sessionId=session(),actor=await ports.repo.transaction(async tx=>{await tx.lock('platform-image-workflow-auth:'+sessionId);const p=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));if(p.sessionId!==sessionId||session()!==sessionId)return fail();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);if(session()!==sessionId)return fail();return p});
 function possessed(){if(session()!==actor.sessionId)return fail()}
 async function guarded<T>(fn:()=>Promise<T>){possessed();const value=await fn();possessed();return value}
 const authority={assertCurrent:(tx:PlatformTransaction,p:PlatformPrincipal)=>guarded(()=>assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails))};
 function protect(r:ImageArtifactResources):ImageArtifactResources{return {
  decoder:{get profileDigest(){possessed();return r.decoder.profileDigest},assertQualified:(d,s)=>guarded(()=>r.decoder.assertQualified(d,s)),inspect:(b,m,s)=>guarded(()=>r.decoder.inspect(b,m,s))},
  readKey:(a,s)=>guarded(()=>r.readKey(a,s)),assertKeyCurrent:(a,k,s)=>guarded(()=>r.assertKeyCurrent(a,k,s)),
  ...(r.readUploadProfile?{readUploadProfile:(a:Parameters<NonNullable<ImageArtifactResources['readUploadProfile']>>[0],s:AbortSignal)=>guarded(()=>r.readUploadProfile!(a,s))}:{}),
  ...(r.assertUploadProfileCurrent?{assertUploadProfileCurrent:(p:unknown,a:Parameters<NonNullable<ImageArtifactResources['assertUploadProfileCurrent']>>[1],s:AbortSignal)=>guarded(()=>r.assertUploadProfileCurrent!(p,a,s))}:{}),
 }}
 const resources=ports.resources?protect(ports.resources):undefined,e=ports.executionResources;
 const executionResources:ImageExecutionResources|undefined=e?{
  ...protect(e),get version(){possessed();return e.version},now:()=>{possessed();return e.now()},
  assertNativeQualified:(b,v,s)=>guarded(()=>e.assertNativeQualified(b,v,s)),assertObservationAllowed:(b,v,s)=>guarded(()=>e.assertObservationAllowed(b,v,s)),
  readCredential:(b,i,s)=>guarded(()=>e.readCredential(b,i,s)),assertCredentialCurrent:(b,k,s)=>guarded(()=>e.assertCredentialCurrent(b,k,s)),
  readGrantKey:(b,s)=>guarded(()=>e.readGrantKey(b,s)),assertGrantKeyCurrent:(b,k,s)=>guarded(()=>e.assertGrantKeyCurrent(b,k,s)),
 }:undefined;
 const postImages=createPostImagePreviewService(ports.repo,authority,resources,request.signal);
 const artifacts=createImageArtifactService(ports.repo,authority,resources,request.signal),execution=createImageExecutionStore(ports.repo,authority,executionResources,request.signal);
 async function inspect(id:string){platformActionId.parse(id);return ports.repo.transaction(async tx=>{
  await tx.lock(id);await authority.assertCurrent(tx,actor);const state=readPlatformAction(await tx.read(id));if(!tx.readImageBinding||!tx.imageStorage)return fail();
  const b=imageBindingForParent(await tx.readImageBinding(id),state,id),effects=[];
  for(let index=0;index<state.plan.effects.length;index++){const status=await tx.readEffect(id,index);effects.push({id:state.plan.effects[index].id,status:status===null?'not_started':status})}
  const grant=await tx.imageStorage.readGrant(),now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt)return fail();
  const action=platformInspectionSchema.parse({actionId:id,version:state.version,status:state.status,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer?.userId??null,plan:state.plan,expired:now>=Date.parse(state.plan.expiresAt),effects,authority:'history_only',sourceValidation:'not_checked'});
  await authority.assertCurrent(tx,actor);
  return imageWorkflowHistory.parse({action,upload:{artifact:b.artifact,bindingDigest:b.bindingDigest,grant:grant?{providerImageReference:grant.context.native.providerImageReference,expiresAt:grant.context.native.expiresAt,claimedAt:grant.claim?.claimedAt??null,result:grant.putResult}:null},authority:'image_history_only',sourceValidation:'not_checked',executionAuthorized:false});
 })}
 async function execute(kind:'initialize'|'put',id:string,version:number,digest:string){return guarded(async()=>{
  const previous=await inspect(id);if(previous.action.plan.digest!==digest||previous.action.version!==version)return fail();
  if(kind==='initialize')await execution.initialize(id,version,actor);else await execution.put(id,version,actor);
  return inspect(id);
 })}
 return Object.freeze({
  previewPost:(id:string)=>guarded(async()=>{
   const v=await postImages.preview(id,actor);try{
    const s=v.state,action=platformInspectionSchema.parse({actionId:id,version:s.version,status:s.status,attemptCount:s.attemptCount,requesterUserId:s.requester.userId,reviewerUserId:s.reviewer?.userId??null,plan:s.plan,expired:false,effects:s.plan.effects.map(e=>({id:e.id,status:'not_started'})),authority:'history_only',sourceValidation:'not_checked'});
    return postImageWorkflowPreview.parse({action,artifact:v.artifact,lineage:v.lineage,renderedPost:v.renderedPost,bytesBase64url:v.bytes.toString('base64url'),authority:'post_image_review_preview_only',executionAuthorized:false});
   }finally{v.bytes.fill(0)}
  }),
  initialize:(id:string,version:number,digest:string)=>execute('initialize',id,version,digest),
  put:(id:string,version:number,digest:string)=>execute('put',id,version,digest),
  intake:(selection:unknown,bytes:Uint8Array)=>guarded(async()=>imageArtifactIntakeResult.parse(await artifacts.intake(selection,bytes,actor))),
  lookupArtifact:(reference:string)=>guarded(async()=>imageArtifactLookupResult.parse(await artifacts.lookupArtifact(reference,actor))),
  prepare:(artifactId:string,expiresAt:string,reference:string)=>guarded(async()=>imagePreparedResult.parse(await artifacts.prepare(artifactId,expiresAt,reference,actor))),
  lookup:(reference:string)=>guarded(async()=>imageActionLookupResult.parse(await artifacts.lookup(reference,actor))),
  inspect:(id:string)=>guarded(()=>inspect(id)),
  preview:(id:string)=>guarded(async()=>{
   const v=await artifacts.preview(id,actor);
   try{
    if(v.bytes.length!==v.binding.artifact.byteCount||createHash('sha256').update(v.bytes).digest('hex')!==v.binding.artifact.bytesDigest)return fail();
    const s=v.state,action=platformInspectionSchema.parse({actionId:id,version:s.version,status:s.status,attemptCount:s.attemptCount,requesterUserId:s.requester.userId,reviewerUserId:s.reviewer?.userId??null,plan:s.plan,expired:false,effects:s.plan.effects.map(e=>({id:e.id,status:'not_started'})),authority:'history_only',sourceValidation:'not_checked'});
    return imageWorkflowPreview.parse({action,artifact:v.binding.artifact,bindingDigest:v.binding.bindingDigest,bytesBase64url:v.bytes.toString('base64url'),authority:'review_preview_only',executionAuthorized:false});
   }finally{v.bytes.fill(0)}
  }),
  review:(id:string,version:number,digest:string)=>guarded(async()=>{await artifacts.review(id,version,digest,actor);return inspect(id)}),
 });
}
