import 'server-only';
import {createHash} from 'node:crypto';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import {platformActionId,platformInspectionSchema} from './viewContract';
import {assertCurrentPlatformPrincipal} from './currentAuthority';
import {createPlatformActionService,type PlatformRepository,type PlatformTransaction} from './actionStore';
import {createImageArtifactService,type ImageArtifactResources} from './imageArtifactService';
import {imageWorkflowHistory,imageWorkflowPreview,imageArtifactIntakeResult,imageArtifactLookupResult,imagePreparedResult,imageActionLookupResult} from './imageWorkflowContract';
interface RequestContext{headers:Headers;signal?:AbortSignal}
interface Ports{repo:PlatformRepository;verifyDesktopToken(token:string):{sessionId:string};readAdminEmails():readonly string[];resources?:ImageArtifactResources}
const fail=():never=>{throw Error('platform_image_workflow_unavailable')};
/** Prepared/unregistered authenticated intake/review. Real decoder/key/profile
 * resources are absent by default. There is no image execution fallback. */
export async function createImageWorkflowRequestComposition(request:RequestContext,ports:Ports){
 function session(){request.signal?.throwIfAborted();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const v=ports.verifyDesktopToken(token);if(typeof v.sessionId!=='string'||!v.sessionId||v.sessionId.length>256)return fail();return v.sessionId}catch{return fail()}}
 const sessionId=session(),actor=await ports.repo.transaction(async tx=>{await tx.lock('platform-image-workflow-auth:'+sessionId);const p=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));if(p.sessionId!==sessionId||session()!==sessionId)return fail();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);if(session()!==sessionId)return fail();return p});
 function possessed(){if(session()!==actor.sessionId)return fail()}
 async function guarded<T>(fn:()=>Promise<T>){possessed();const value=await fn();possessed();return value}
 const authority={assertCurrent:(tx:PlatformTransaction,p:PlatformPrincipal)=>guarded(()=>assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails))},r=ports.resources;
 const resources:ImageArtifactResources|undefined=r?{
  decoder:{profileDigest:r.decoder.profileDigest,assertQualified:(d,s)=>guarded(()=>r.decoder.assertQualified(d,s)),inspect:(b,m,s)=>guarded(()=>r.decoder.inspect(b,m,s))},
  readKey:(a,s)=>guarded(()=>r.readKey(a,s)),assertKeyCurrent:(a,k,s)=>guarded(()=>r.assertKeyCurrent(a,k,s)),
  ...(r.readUploadProfile?{readUploadProfile:(a:Parameters<NonNullable<ImageArtifactResources['readUploadProfile']>>[0],s:AbortSignal)=>guarded(()=>r.readUploadProfile!(a,s))}:{}),
  ...(r.assertUploadProfileCurrent?{assertUploadProfileCurrent:(p:unknown,a:Parameters<NonNullable<ImageArtifactResources['assertUploadProfileCurrent']>>[1],s:AbortSignal)=>guarded(()=>r.assertUploadProfileCurrent!(p,a,s))}:{}),
 }:undefined;
 const artifacts=createImageArtifactService(ports.repo,authority,resources,request.signal),actions=createPlatformActionService(ports.repo,authority);
 async function inspect(id:string){platformActionId.parse(id);const action=await actions.inspect(id,actor);return imageWorkflowHistory.parse({action,authority:'image_history_only',sourceValidation:'not_checked',executionAuthorized:false})}
 return Object.freeze({
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
