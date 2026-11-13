import type {DeploymentTiming,DeploymentNativeTransport} from './deploymentNativeTransport';
import type {ExecutionTimeCheck} from './executionTime';
import {bindPlatformDeploymentExecution} from './effectExecution';
import type {ExecutionTimeSource} from './executionTime';
import 'server-only';
import type {PlatformSourceKind} from './sourceCatalog';
import type {PlatformHistoryCursor} from './historyContract';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema,type PlatformEffect} from './contracts';
import {compilePlatformPlan} from './kernel';
import {createPlatformActionService,type PlatformRepository} from './actionStore';
import {createCurrentPlatformAuthority} from './currentAuthority';
interface Ports{
 repo:PlatformRepository;
 /** Resource-free constructor only; real native qualification remains required. */
 deploymentTransport?:(timing:DeploymentTiming&{actionId:string})=>Readonly<DeploymentNativeTransport>;
 clock?:ExecutionTimeSource;
 verifyDesktopToken(token:string):{sessionId:string};
 readAdminEmails():readonly string[];
}
const fail=():never=>{throw Error('platform_governance_request_unavailable')};
/** Private server factory. Ports and observation proofs are never request JSON.
 * Token verification proves possession; current SQL authority proves privilege.
 * No cookie/API-key/cron fallback and no incidental session heartbeat/self-heal. */
export async function createPlatformRequestComposition(request:{headers:Headers;signal?:AbortSignal},ports:Ports){
 const clock=ports.clock,deploymentFactory=ports.deploymentTransport;
 function verifiedSession(){
  request.signal?.throwIfAborted();
  const token=bearerFromHeader(request.headers.get('authorization'));
  if(!token||token.length>4096)fail();
  try{const result=ports.verifyDesktopToken(token!);if(typeof result.sessionId!=='string'||!result.sessionId||result.sessionId.length>256)fail();return result.sessionId}catch{return fail()}
 }
 const sessionId=verifiedSession(),currentAuthority=createCurrentPlatformAuthority(ports.readAdminEmails);
 const principal=await ports.repo.transaction(async tx=>{
  await tx.lock('platform-auth:'+sessionId);
  const actor=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));
  if(actor.sessionId!==sessionId||verifiedSession()!==sessionId)fail();
  await currentAuthority.assertCurrent(tx,actor);
  if(verifiedSession()!==sessionId)fail();return actor;
 });
 function assertPossession(){if(verifiedSession()!==principal.sessionId)fail()}
 const guardedClock:ExecutionTimeSource=async signal=>{assertPossession();if(typeof clock!=='function')return fail();const value=await clock(signal);assertPossession();return value};
 const store=createPlatformActionService(ports.repo,{async assertCurrent(tx,actor){
  assertPossession();await currentAuthority.assertCurrent(tx,actor);assertPossession();
 },async assertEffectCurrent(tx,effect){assertPossession();await currentAuthority.assertEffectCurrent!(tx,effect);assertPossession()}},{clock:guardedClock,signal:request.signal});
 return Object.freeze({
  actorUserId:principal.userId,
  createDeploymentExecutionBinding(actionId:string,checks?:{beforeCredential?():Promise<void>;beforeSend?():Promise<void>;beforeResult?():Promise<void>}){
   assertPossession();if(!deploymentFactory||!(request.signal instanceof AbortSignal))return fail();
   const timing={clock:guardedClock,signal:request.signal},transport=deploymentFactory({...timing,actionId}),beforeCredential=checks?.beforeCredential,beforeSend=checks?.beforeSend,beforeResult=checks?.beforeResult;
   const binding=bindPlatformDeploymentExecution({actorUserId:principal.userId,
    async claimNextEffect(id){assertPossession();const result=await store.claimNextEffect(id,principal);assertPossession();return result},
    async beforeEffectCredential(proof,effect,check){assertPossession();await beforeCredential?.();assertPossession();await store.beforeEffectCredential(proof,effect,principal,check);assertPossession()},
    async beforeEffectSend(proof,effect,check){assertPossession();await beforeSend?.();assertPossession();await store.beforeEffectSend(proof,effect,principal,check);assertPossession()},
    observeEffect:store.observeEffect,
    async beforeEffectResult(proof){assertPossession();await beforeResult?.();assertPossession();await store.beforeEffectResult(proof,principal);assertPossession()},
   },actionId,transport,timing);assertPossession();return binding;
  },
  async prepareTemplate(raw:unknown,requestId:string){assertPossession();return store.prepareTemplate(raw,principal,requestId)},
  async lookupTemplatePreparation(requestId:string){assertPossession();return store.lookupTemplatePreparation(requestId,principal)},
  async previewTemplate(id:string){assertPossession();return store.previewTemplate(id,principal)},
  async prepareDeployment(raw:unknown,requestId:string){assertPossession();return store.prepareDeployment(raw,principal,requestId)},
  async previewDeployment(id:string){assertPossession();return store.previewDeployment(id,principal)},
  async readDeploymentExecutionSource(id:string,planDigest:string){assertPossession();const result=await store.readDeploymentExecutionSource(id,planDigest,principal);assertPossession();return result},
  async inspectDeployment(id:string){assertPossession();const result=await store.inspectDeployment(id,principal);assertPossession();return result},
  async lookupDeploymentPreparation(requestId:string){assertPossession();return store.lookupDeploymentPreparation(requestId,principal)},
  async sources(kind:PlatformSourceKind,cursor:string|null){assertPossession();return store.sources(kind,cursor,principal)},
  async history(cursor:PlatformHistoryCursor|null){assertPossession();return store.history(cursor,principal)},
  async previewGrowth(id:string){assertPossession();return store.previewGrowth(id,principal)},
  async lookupGrowthPreparation(requestId:string){assertPossession();return store.lookupGrowthPreparation(requestId,principal)},
  async prepareGrowth(raw:unknown,requestId?:string){assertPossession();return store.prepareGrowth(raw,principal,requestId)},
  async inspect(id:string){assertPossession();return store.inspect(id,principal)},
  async propose(raw:unknown){assertPossession();return store.propose(compilePlatformPlan(raw),principal)},
  async review(id:string,version:number,planDigest:string){assertPossession();await store.review(id,version,planDigest,principal)},
  async claim(id:string,version:number){assertPossession();await store.claim(id,version,principal)},
  async claimNextEffect(id:string){assertPossession();return store.claimNextEffect(id,principal)},
  async beforeEffectSend(proof:object,effect:PlatformEffect,check?:ExecutionTimeCheck){assertPossession();await store.beforeEffectSend(proof,effect,principal,check)},
  async beforeEffectCredential(proof:object,effect:PlatformEffect,check:ExecutionTimeCheck){assertPossession();await store.beforeEffectCredential(proof,effect,principal,check)},
  // Private transport observation may outlive session expiry after a send.
  // No public endpoint may accept a caller's invented outcome/proof.
  observeEffect:store.observeEffect,
  async beforeEffectResult(proof:object){assertPossession();await store.beforeEffectResult(proof,principal);assertPossession()},
 });
}
