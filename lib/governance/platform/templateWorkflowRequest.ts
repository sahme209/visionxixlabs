import 'server-only';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import {platformActionId,platformInspectionSchema} from './viewContract';
import {assertCurrentPlatformPrincipal} from './currentAuthority';
import {createPlatformActionService,type PlatformRepository,type PlatformTransaction} from './actionStore';
import {createTemplatePreparationStore,type TemplatePreparationProfiles} from './templatePreparationStore';
import {createTemplateExecutionStore,type TemplateExecutionResources} from './templateExecutionStore';
import {templateWorkflowHistory,templateWorkflowPreview,templateWorkflowOutput} from './templateWorkflowContract';
interface RequestContext{headers:Headers;signal?:AbortSignal}
interface Ports{repo:PlatformRepository;verifyDesktopToken(token:string):{sessionId:string};readAdminEmails():readonly string[];resources?:Omit<TemplateExecutionResources,'assertDeliveryChannel'>&{assertDeliveryChannel?(binding:Parameters<NonNullable<TemplateExecutionResources['assertDeliveryChannel']>>[0],artifactRef:string,request:RequestContext):Promise<void>}}
const fail=():never=>{throw Error('platform_template_workflow_unavailable')};
/** Prepared private composition, not a registered route. Real sources, keys,
 * clocks and request-bound output channels are deliberately absent by default.
 * Possession/current SQL identity never qualifies those separate suppliers. */
export async function createTemplateWorkflowRequestComposition(request:RequestContext,ports:Ports){
 function session(){request.signal?.throwIfAborted();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const value=ports.verifyDesktopToken(token);if(typeof value.sessionId!=='string'||!value.sessionId||value.sessionId.length>256)return fail();return value.sessionId}catch{return fail()}}
 const sessionId=session(),actor=await ports.repo.transaction(async tx=>{await tx.lock('platform-template-workflow-auth:'+sessionId);const p=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));if(p.sessionId!==sessionId||session()!==sessionId)return fail();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);if(session()!==sessionId)return fail();return p});
 function possessed(){if(session()!==actor.sessionId)return fail()}
 async function guarded<T>(fn:()=>Promise<T>){possessed();const result=await fn();possessed();return result}
 const authority={async assertCurrent(tx:PlatformTransaction,p:PlatformPrincipal){await guarded(()=>assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails))}};
 const r=ports.resources,clock=r?.clock,dispatch=r?.assertDispatchCurrent?.bind(r),credentialFacts=r?.assertCredentialCurrent?.bind(r);
 const profiles:TemplatePreparationProfiles|undefined=r?{read:s=>guarded(()=>r.profiles.read(s)),assertQualified:(p,s)=>guarded(()=>r.profiles.assertQualified(p,s))}:undefined;
 const resources:TemplateExecutionResources|undefined=r?{
  clock:signal=>guarded(()=>clock!.call(r,signal)),profiles:profiles!,assertQualified:b=>guarded(()=>r.assertQualified(b)),
  ...(credentialFacts?{assertCredentialCurrent:(...args:Parameters<NonNullable<TemplateExecutionResources['assertCredentialCurrent']>>)=>guarded(()=>credentialFacts(...args))}:{}),
  ...(dispatch?{assertDispatchCurrent:(...args:Parameters<NonNullable<TemplateExecutionResources['assertDispatchCurrent']>>)=>guarded(()=>dispatch(...args))}:{}),
  readCredential:b=>{possessed();const value=r.readCredential(b);possessed();return value},now:()=>{possessed();const value=r.now();possessed();return value},
  ...(r.readArtifactKey?{readArtifactKey:(b:Parameters<NonNullable<TemplateExecutionResources['readArtifactKey']>>[0])=>{possessed();const value=r.readArtifactKey!(b);possessed();return value}}:{}),
  ...(r.assertArtifactKeyCurrent?{assertArtifactKeyCurrent:(b:Parameters<NonNullable<TemplateExecutionResources['assertArtifactKeyCurrent']>>[0])=>guarded(()=>r.assertArtifactKeyCurrent!(b))}:{}),
  ...(r.assertDeliveryChannel?{assertDeliveryChannel:(b:Parameters<NonNullable<TemplateExecutionResources['assertDeliveryChannel']>>[0],ref:string)=>guarded(()=>r.assertDeliveryChannel!(b,ref,request))}:{}),
  ...(r.expiryQualification?{expiryQualification:(b:Parameters<NonNullable<TemplateExecutionResources['expiryQualification']>>[0])=>guarded(()=>r.expiryQualification!(b))}:{}),
 }:undefined;
 const preparation=createTemplatePreparationStore(ports.repo,authority,profiles),execution=createTemplateExecutionStore(ports.repo,authority,resources,request.signal),actions=createPlatformActionService(ports.repo,authority);
 async function inspect(id:string){platformActionId.parse(id);const history=await execution.history(id,actor),action=await actions.inspect(id,actor);if(history.actionId!==action.actionId||history.status!==action.status||history.attemptCount!==action.attemptCount)return fail();return templateWorkflowHistory.parse({action,receipts:history.receipts,deliveries:history.deliveries,authority:history.authority,sourceValidation:history.sourceValidation,executionAuthorized:history.executionAuthorized})}
 async function exact(id:string,digest:string,version?:number){const value=await inspect(id);if(value.action.plan.digest!==digest||version!==undefined&&value.action.version!==version)return fail();return value}
 return Object.freeze({
  prepare:(selection:unknown,reference:string)=>guarded(()=>preparation.prepare(selection,reference,actor)),
  lookup:(reference:string)=>guarded(()=>preparation.lookup(reference,actor)),
  inspect:(id:string)=>guarded(()=>inspect(id)),
  preview:(id:string)=>guarded(async()=>{platformActionId.parse(id);const v=await preparation.preview(id,actor),s=v.state,b=v.binding;const action=platformInspectionSchema.parse({actionId:id,version:s.version,status:s.status,attemptCount:s.attemptCount,requesterUserId:s.requester.userId,reviewerUserId:s.reviewer?.userId??null,plan:s.plan,expired:false,effects:s.plan.effects.map(e=>({id:e.id,status:'not_started'})),authority:'history_only',sourceValidation:'not_checked'});return templateWorkflowPreview.parse({action,bindingDigest:b.bindingDigest,profileDigest:b.profileDigest,artifactProfileDigest:b.access?.artifactProfileDigest??null,delivery:b.access?.delivery??null,content:b.effect.kind==='template.bucket.create'?{kind:'bucket',ownership:'not_observed'}:{kind:'source',yaml:v.sourceContent,bytesDigest:b.effect.kind==='template.object.put'||b.effect.kind==='template.access.grant'?b.effect.target.bytesDigest:fail()},authority:'review_preview_only',executionAuthorized:false})}),
  review:(id:string,version:number,digest:string)=>guarded(async()=>{await exact(id,digest,version);await preparation.review(id,version,digest,actor);return inspect(id)}),
  execute:(id:string,version:number,digest:string)=>guarded(async()=>{await exact(id,digest,version);await execution.execute(id,version,actor);return inspect(id)}),
  deliver:(id:string,ref:string,digest:string)=>guarded(async()=>{await exact(id,digest);const output=templateWorkflowOutput.parse(await execution.deliver(id,ref,actor));if(output.actionId!==id||output.artifactRef!==ref)return fail();return output}),
 });
}
