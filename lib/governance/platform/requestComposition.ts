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
 verifyDesktopToken(token:string):{sessionId:string};
 readAdminEmails():readonly string[];
}
const fail=():never=>{throw Error('platform_governance_request_unavailable')};
/** Private server factory. Ports and observation proofs are never request JSON.
 * Token verification proves possession; current SQL authority proves privilege.
 * No cookie/API-key/cron fallback and no incidental session heartbeat/self-heal. */
export async function createPlatformRequestComposition(request:{headers:Headers},ports:Ports){
 function verifiedSession(){
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
 const store=createPlatformActionService(ports.repo,{async assertCurrent(tx,actor){
  assertPossession();await currentAuthority.assertCurrent(tx,actor);assertPossession();
 },async assertEffectCurrent(tx,effect){assertPossession();await currentAuthority.assertEffectCurrent!(tx,effect);assertPossession()}});
 return Object.freeze({
  actorUserId:principal.userId,
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
  async beforeEffectSend(proof:object,effect:PlatformEffect){assertPossession();await store.beforeEffectSend(proof,effect,principal)},
  // Private transport observation may outlive session expiry after a send.
  // No public endpoint may accept a caller's invented outcome/proof.
  observeEffect:store.observeEffect,
 });
}
