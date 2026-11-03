import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {deploymentPlanSchema,type DeploymentPlan,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import type {ReleaseDeploymentExecutionStore} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {createEnrollmentDrainStore} from './enrollmentDrainStore';
import {createEnrollmentDrainAuthority} from './enrollmentDrainAuthority';
import {readDeploymentOutboundIssuerDigest} from './deploymentOutboundIssuer';
import type {DrainOutboundBinding} from './drainContracts';
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const profile='github.workflow_dispatch.v1';
const refuse=():never=>{throw Error('governance_deployment_outbound_unavailable')};
/** Real request/coordinator adapter, not coverage or executing-identity proof.
 * The actual canonical issuer seam currently refuses. Simulated tests replace
 * only that module seam, never production parameters or a request field.
 * Slots remain blocking even after a confirmed HTTP/workflow receipt. */
export function createDeploymentOutboundDrain(repo:ReleaseOperationPlanRepo,request:NextRequest,rawScope:DeploymentScope,operationId:string,store:Pick<ReleaseDeploymentExecutionStore,'readClaimedOutboundLocked'>,ports:{signal:AbortSignal;isEnabled:()=>boolean}){
 const scope=structuredClone(rawScope),parent=ports.signal;
 if(!/^release_deployment_[a-f0-9]{64}$/.test(operationId))refuse();
 const ready=(signal:AbortSignal)=>{parent.throwIfAborted();signal.throwIfAborted();if(!ports.isEnabled())refuse()};
 function issuer(signal:AbortSignal){ready(signal);const result=digest.parse(readDeploymentOutboundIssuerDigest());ready(signal);return result;}
 let originalPlan:Readonly<DeploymentPlan>|undefined,originalSignal:AbortSignal|undefined,originalIssuer:string|undefined,reservation:Promise<void>|undefined;
 function compose(plan:Readonly<DeploymentPlan>,signal:AbortSignal,issuerDigest:string){
  const currentIssuer=()=>{if(issuer(signal)!==issuerDigest)refuse()};
  async function claimed(tx:Tx,s:DeploymentScope){
   ready(signal);currentIssuer();if(hash(s)!==hash(scope))refuse();
   const proof=await store.readClaimedOutboundLocked(tx,scope,operationId,plan);
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
  /** Called before the existing credential-exposure reservation/mint. One
   * request can reuse only its own successful reservation; a restarted request
   * cannot adopt it to remint. Lost ack leaves the real persisted blocker. */
  async beforeCredential(raw:Readonly<DeploymentPlan>,callerSignal:AbortSignal){
   const plan=deploymentPlanSchema.parse(raw),signal=AbortSignal.any([parent,callerSignal]);ready(signal);
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
  async beforeSubmission(id:string,raw:Readonly<DeploymentPlan>,callerSignal:AbortSignal):Promise<()=>void>{
   const plan=deploymentPlanSchema.parse(raw),signal=AbortSignal.any([parent,callerSignal]);ready(signal);
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
