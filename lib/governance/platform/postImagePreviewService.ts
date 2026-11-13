import 'server-only';
import {assertPlatformParticipantsTime} from './principalTime';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import type {PlatformRepository,PlatformTransaction,PlatformAuthority} from './actionStore';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import {platformActionId} from './viewContract';
import {readPlatformAction} from './kernel';
import {prepareGrowthPlatformPlan} from './growthPreparation';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {imageArtifactMetadata} from './imageCustodyContract';
import {imagePublicationLineageSchema} from './imagePublicationLineage';
import {openImageArtifact} from './imageCustodyCodec';
import type {ImageArtifactResources} from './imageArtifactService';
const fail=():never=>{throw Error('platform_post_image_preview_unavailable')};
const savedSchema=z.object({lineage:imagePublicationLineageSchema,artifact:z.object({metadata:imageArtifactMetadata,envelope:z.string().max(4000000),createdAt:z.number().int().nonnegative().safe()}).strict()}).strict();
const decoded=z.object({mimeType:z.enum(['image/png','image/jpeg']),width:z.number().int().positive().safe(),height:z.number().int().positive().safe(),formatProfileDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
/** Prepared private read only. New action/current people grant preview access;
 * confirmed upload history supplies provenance, never old approval authority. */
export function createPostImagePreviewService(repo:PlatformRepository,authority:PlatformAuthority,resources?:ImageArtifactResources,requestSignal?:AbortSignal){
 const clock=resources?.clock;
 return {async preview(id:string,rawActor:PlatformPrincipal){
  platformActionId.parse(id);const actor=platformPrincipalSchema.parse(rawActor);if(!resources||typeof clock!=='function'||!(requestSignal instanceof AbortSignal))return fail();
  const signal=AbortSignal.any([AbortSignal.timeout(5000),...(requestSignal?[requestSignal]:[])]);let bytes:Buffer|undefined,key:Buffer|undefined,committed=false,activeArtifact:z.infer<typeof imageArtifactMetadata>|undefined;
  const clear=()=>{bytes?.fill(0);key?.fill(0)};signal.addEventListener('abort',clear,{once:true});
  async function checked<T>(fn:()=>Promise<T>){signal.throwIfAborted();const value=await fn();signal.throwIfAborted();return value}
  let rejectAbort!:()=>void;const abort=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(Error('stopped'));signal.addEventListener('abort',rejectAbort,{once:true})});
  try{signal.throwIfAborted();const result=await Promise.race([repo.transaction(async tx=>{
   await checked(()=>tx.lock(id));const state=readPlatformAction(await checked(()=>tx.read(id))),effect=state.plan.effects[0];
   if(!['proposed','approved'].includes(state.status)||state.plan.effects.length!==1||(effect.kind!=='growth.post.publish'&&effect.kind!=='growth.schedule.change')||!effect.target.imageUploadActionId||!effect.target.imageLineageDigest||!tx.readReadyImageArtifact)return fail();
   // Exact requester identity, or a current distinct reviewer. Once reviewed,
   // only those two exact principals retain access to this action's preview.
   if(actor.userId===state.requester.userId?hash(actor)!==hash(state.requester):state.reviewer!==null&&hash(actor)!==hash(state.reviewer))return fail();
   const actors=[actor,state.requester,...(state.reviewer?[state.reviewer]:[])];
   const selection={operation:effect.kind==='growth.post.publish'?'publish':'schedule',draftId:effect.target.draftId,connectionId:effect.target.connectionId,imageUploadActionId:effect.target.imageUploadActionId,expiresAt:state.plan.expiresAt,...(effect.kind==='growth.schedule.change'?{scheduledFor:effect.target.scheduledFor}:{})};
   async function sourceCurrent(){
    for(const p of actors)await checked(()=>authority.assertCurrent(tx,p));
    const now=await checked(()=>tx.now());if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.plan.expiresAt))return fail();
    const prepared=await checked(()=>prepareGrowthPlatformPlan(tx,selection,now,effect.id));
    if(hash(prepared.plan)!==hash(state.plan)||!prepared.preview.renderedPost)return fail();
    for(const p of actors)await checked(()=>authority.assertCurrent(tx,p));
    if(await checked(()=>tx.now())>=Date.parse(state.plan.expiresAt))return fail();return prepared.preview.renderedPost;
   }
   async function current(){
    await sourceCurrent();
    // The exact source-plan check requires action expiry <= connection expiry;
    // re-reading that source after time preserves its native connection bound.
    await checked(()=>assertPlatformParticipantsTime(tx,actors,clock!,{expiresAt:Date.parse(state.plan.expiresAt)},signal));
    const rendered=await sourceCurrent();
    if(activeArtifact){if(resources!.decoder.profileDigest!==activeArtifact.formatProfileDigest)return fail();await checked(()=>resources!.decoder.assertQualified(activeArtifact!.formatProfileDigest,signal));if(key)await checked(()=>resources!.assertKeyCurrent(activeArtifact!,key!,signal))}
    for(const p of actors)await checked(()=>authority.assertCurrent(tx,p));return rendered;
   }
   await current();const saved=savedSchema.parse(await checked(()=>tx.readReadyImageArtifact!(effect.target.imageUploadActionId!,effect.target.connectionId))),a=saved.artifact.metadata,l=saved.lineage;
   if(l.uploadActionId!==effect.target.imageUploadActionId||l.lineageDigest!==effect.target.imageLineageDigest||a.artifactId!==l.artifactId||a.bytesDigest!==l.bytesDigest||a.connectionId!==l.connectionId||a.author!==l.author)return fail();
   activeArtifact=a;await current();const rawKey=await checked(()=>resources.readKey(a,signal));if(!(rawKey instanceof Uint8Array)||rawKey.byteLength!==32)return fail();key=Buffer.from(rawKey);
   await current();await checked(()=>resources.assertKeyCurrent(a,key!,signal));await current();bytes=openImageArtifact(key,a,saved.artifact.envelope);
   const profile=resources.decoder.profileDigest;if(profile!==a.formatProfileDigest)return fail();
   await checked(()=>resources.decoder.assertQualified(profile,signal));await current();
   const actual=decoded.parse(await checked(()=>resources.decoder.inspect(bytes!,a.mimeType,signal)));
   await current();await checked(()=>resources.decoder.assertQualified(profile,signal));await checked(()=>resources.assertKeyCurrent(a,key!,signal));
   const renderedPost=await current();if(resources.decoder.profileDigest!==profile||actual.formatProfileDigest!==profile||actual.mimeType!==a.mimeType||actual.width!==a.width||actual.height!==a.height||bytes.length!==a.byteCount||createHash('sha256').update(bytes).digest('hex')!==a.bytesDigest)return fail();
   return {state,artifact:a,lineage:l,renderedPost,bytes};
  }),abort]);signal.throwIfAborted();committed=true;return result;
  }catch{return fail()}finally{key?.fill(0);if(!committed)bytes?.fill(0);signal.removeEventListener('abort',clear);signal.removeEventListener('abort',rejectAbort)}
 }};
}
