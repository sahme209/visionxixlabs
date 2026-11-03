import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {slackNotificationIntentSchema,type SlackNotificationIntent as Intent,type SlackNotificationScope as Scope} from '@/lib/integrations/slack/slackNotificationContract';
import type {createSlackNotificationStore} from '@/lib/integrations/slack/slackNotificationStore';
type Store=ReturnType<typeof createSlackNotificationStore>;
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {createEnrollmentDrainStore} from './enrollmentDrainStore';
import {createEnrollmentDrainAuthority} from './enrollmentDrainAuthority';
import {readSlackOutboundIssuerDigest} from './slackOutboundIssuer';
import type {DrainOutboundBinding} from './drainContracts';
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const profile='slack.channel_message.v1';
const refuse=():never=>{throw Error('governance_slack_outbound_unavailable')};
/** Real request/coordinator adapter, not coverage or executing-identity proof.
 * The actual canonical issuer seam currently refuses. Simulated tests replace
 * only that module seam, never production parameters or a request field.
 * Slots remain blocking even after a confirmed provider receipt. */
export function createSlackOutboundDrain(repo:ReleaseOperationPlanRepo,request:NextRequest,rawScope:Scope,operationId:string,store:Pick<Store,'readClaimedSlackOutboundLocked'>,ports:{signal:AbortSignal;isEnabled:()=>boolean}){
 const scope=structuredClone(rawScope),parent=ports.signal;
 if(!/^slack_notification_[a-f0-9]{64}$/.test(operationId))refuse();
 const ready=(signal:AbortSignal)=>{parent.throwIfAborted();signal.throwIfAborted();if(!ports.isEnabled())refuse()};
 function issuer(signal:AbortSignal){ready(signal);const result=digest.parse(readSlackOutboundIssuerDigest());ready(signal);return result;}
 let originalPlan:Readonly<Intent>|undefined,originalSignal:AbortSignal|undefined,originalIssuer:string|undefined,reservation:Promise<void>|undefined;
 function compose(plan:Readonly<Intent>,signal:AbortSignal,issuerDigest:string){
  const currentIssuer=()=>{if(issuer(signal)!==issuerDigest)refuse()};
  async function claimed(tx:Tx,s:Scope){
   ready(signal);currentIssuer();if(hash(s)!==hash(scope))refuse();
   const proof=await store.readClaimedSlackOutboundLocked(tx,scope,operationId,plan);
   if(typeof proof.fresh!=='function')refuse();proof.fresh();currentIssuer();return proof;
  }
  const drain=createEnrollmentDrainStore(repo,{signal,
   assertAuthority:createEnrollmentDrainAuthority(request),
   verifyOperation:async(tx,s,b)=>{
    const proof=await claimed(tx,s);
    const expected={operationId,attemptId:proof.attemptId,profile,targetDigest:proof.targetDigest,connectionId:proof.connectionId,sourceDigest:proof.sourceDigest,issuerArtifactDigest:issuerDigest};
    const{serverNonce:_,...actual}=b;if(hash(actual)!==hash(expected))refuse();
    return()=>{ready(signal);proof.fresh();currentIssuer()};
   },
   // Deliberately no plan/drain-start or provider-effect quiescence verifier.
  });
  async function binding(){
   ready(signal);currentIssuer();
   const proof=await repo.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(scope.organizationId)}))`;
    return claimed(tx,scope);
   });
   proof.fresh();currentIssuer();
   return {operationId,attemptId:proof.attemptId,profile,targetDigest:proof.targetDigest,connectionId:proof.connectionId,sourceDigest:proof.sourceDigest,issuerArtifactDigest:issuerDigest} satisfies Omit<DrainOutboundBinding,'serverNonce'>;
  }
  return {drain,binding,currentIssuer};
 }
 return {
  /** Pure canonical availability check before consuming an approved attempt.
   * No slot, credential, provider request or digest leaves this boundary. */
  assertAvailable(){issuer(parent)},
  /** Called before postclaim persisted-credential resolution. One
   * request can reuse only its own successful reservation; a restarted request
   * cannot adopt it to re-resolve the bearer. Lost ack leaves the real persisted blocker. */
  async beforeCredential(raw:Readonly<Intent>,callerSignal:AbortSignal){
   const plan=slackNotificationIntentSchema.parse(raw),signal=AbortSignal.any([parent,callerSignal]);ready(signal);
   if(plan.organizationId!==scope.organizationId)refuse();
   const issuerDigest=issuer(signal);
   if(originalIssuer&&originalIssuer!==issuerDigest)refuse();
   if(originalPlan&&hash(originalPlan)!==hash(plan))refuse();
   if(originalSignal?.aborted)refuse();
   if(!reservation){originalPlan=structuredClone(plan);originalSignal=signal;originalIssuer=issuerDigest;reservation=(async()=>{const work=compose(plan,signal,issuerDigest),b=await work.binding();await work.drain.reserveAttempt(scope,b);work.currentIssuer()})();}
   await reservation;ready(signal);if(originalSignal?.aborted)refuse();if(issuer(signal)!==issuerDigest)refuse();
  },
  /** Actual fixed-transport submission hook. Recover the association from its
   * durable row, revalidate exact original authority under org-first locks, then
   * return only the committed once-consumable intent freshness closure. */
  async beforeSubmission(id:string,raw:Readonly<Intent>,callerSignal:AbortSignal):Promise<()=>void>{
   const plan=slackNotificationIntentSchema.parse(raw),signal=AbortSignal.any([parent,callerSignal]);ready(signal);
   if(id!==operationId||!originalPlan||!reservation||originalSignal?.aborted||hash(originalPlan)!==hash(plan))refuse();
   await reservation;ready(signal);
   const issuerDigest=issuer(signal);if(issuerDigest!==originalIssuer)refuse();
   const work=compose(plan,signal,issuerDigest),b=await work.binding();
   const saved=await work.drain.readAttempt(scope,b.operationId,b.attemptId);
   const {serverNonce:_,...stored}=saved.binding;
   if(saved.status!=='reserved'||hash(saved.originalScope)!==hash(scope)||hash(stored)!==hash(b))refuse();
   let consume:(()=>void)|undefined;
   await work.drain.markSubmissionIntent(scope,saved.id,fresh=>{consume=fresh});
   ready(signal);work.currentIssuer();if(typeof consume!=='function')refuse();
   return()=>{ready(signal);if(originalSignal?.aborted)refuse();work.currentIssuer();consume!();ready(signal)};
  },
 };
}
