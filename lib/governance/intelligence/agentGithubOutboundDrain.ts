import 'server-only';
import {z} from 'zod';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {createAgentActionExecutionStore,AgentExecutionClaim} from '@/lib/axiom/agentRuntime/agentActionExecutionStore';
import {agentExecutionScopeSchema,type AgentExecutionScope} from '@/lib/axiom/agentRuntime/agentActionExecutionContract';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {createEnrollmentDrainStore} from './enrollmentDrainStore';
import {createEnrollmentDrainAuthority} from './enrollmentDrainAuthority';
import {readAgentGithubOutboundIssuerDigest} from './agentGithubOutboundIssuer';
import type {DrainOutboundBinding} from './drainContracts';
type Store=ReturnType<typeof createAgentActionExecutionStore>;
type Input=Parameters<Store['readClaimedGithubOutboundLocked']>[3];
const refuse=():never=>{throw Error('governance_agent_github_outbound_unavailable')};
/** Actual private-claim adapter; positive tests simulate issuer only. It never
 * supplies coverage, clears a slot or marks provider effects quiescent. */
export function createAgentGithubOutboundDrain(repo:ReleaseOperationPlanRepo,request:NextRequest,rawScope:AgentExecutionScope,id:string,store:Pick<Store,'readClaimedGithubOutboundLocked'>,source:Input['source'],connection:Input['connection'],signal:AbortSignal=request.signal){
 const scope=agentExecutionScopeSchema.parse(rawScope),original=structuredClone({source,connection});
 if(!/^agent_execution_[a-f0-9]{64}$/.test(id))refuse();
 const ready=()=>{request.signal.throwIfAborted();signal.throwIfAborted()};
 const issuer=()=>{ready();return z.string().regex(/^[a-f0-9]{64}$/).parse(readAgentGithubOutboundIssuerDigest())};
 let claim:AgentExecutionClaim|undefined,issuerDigest:string|undefined,reservation:Promise<void>|undefined;
 function compose(){
  if(!claim||!issuerDigest)refuse();const proof=claim!,digest=issuerDigest!;
  const current=()=>{ready();if(issuer()!==digest)refuse()};
  const read=async(tx:Tx)=>{current();const value=await store.readClaimedGithubOutboundLocked(tx,scope,proof,original);value.fresh();current();return value};
  const expected=async(tx:Tx)=>{const value=await read(tx);return{value,binding:{operationId:id,attemptId:value.attemptId,profile:value.profile,targetDigest:value.targetDigest,sourceDigest:value.sourceDigest,connectionId:value.connectionId,issuerArtifactDigest:digest} satisfies Omit<DrainOutboundBinding,'serverNonce'>}};
  const drain=createEnrollmentDrainStore(repo,{signal,assertAuthority:createEnrollmentDrainAuthority(request),verifyOperation:async(tx,s,b)=>{if(hash(s)!==hash(scope))refuse();const value=await expected(tx);const{serverNonce:_,...actual}=b;if(hash(actual)!==hash(value.binding))refuse();return()=>{current();value.value.fresh()}}});
  const binding=async()=>{const result=await repo.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+hash(scope.organizationId)}))`;return expected(tx)});result.value.fresh();current();return result.binding};
  return{drain,binding,current};
 }
 return{
  assertAvailable(){issuer()},
  async beforeCredential(privateClaim:AgentExecutionClaim){
   ready();if(privateClaim.operationId!==id)refuse();const digest=issuer();if(claim&&claim!==privateClaim||issuerDigest&&issuerDigest!==digest)refuse();
   if(!reservation){claim=privateClaim;issuerDigest=digest;reservation=(async()=>{const work=compose(),binding=await work.binding();await work.drain.reserveAttempt(scope,binding);work.current()})()}
   await reservation;ready();if(issuer()!==issuerDigest)refuse();
  },
  async beforeSubmission():Promise<()=>void>{
   if(!reservation||!claim)refuse();await reservation;const work=compose(),binding=await work.binding();
   const saved=await work.drain.readAttempt(scope,id,binding.attemptId);const{serverNonce:_,...actual}=saved.binding;
   if(saved.status!=='reserved'||hash(saved.originalScope)!==hash(scope)||hash(actual)!==hash(binding))refuse();
   let consume:(()=>void)|undefined;await work.drain.markSubmissionIntent(scope,saved.id,fresh=>{consume=fresh});work.current();if(typeof consume!=='function')refuse();
   return()=>{work.current();consume!();ready()};
  },
 };
}
