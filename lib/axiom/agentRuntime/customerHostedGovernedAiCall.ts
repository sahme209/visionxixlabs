import {denyIsolatedExternalIO} from "@/lib/billing/isolatedApplication/runtime";
import 'server-only';
import {prisma} from '@/lib/db';
import {createCustomerHostedCurrentReader} from '@/lib/ai/customerHostedCurrentPolicy';
import {parseCustomerHostedOperatorConfig,readInstallationAIMode} from '@/lib/ai/customerHostedConfig';
import {createCustomerHostedTokenRepository,type CustomerHostedSqlRepository} from '@/lib/ai/customerHostedTokenRepository';
import {createCustomerHostedTokenStore} from '@/lib/ai/customerHostedTokenStore';
import {createCustomerHostedExtraction} from '@/lib/ai/customerHostedExtraction';
import {sendCustomerHostedCompletion} from '@/lib/ai/customerHostedTransport';
import {record} from '@/lib/audit/secureAudit';
import {id} from '@/lib/domain/ids';
import {AgentStreamInterrupted} from '@/lib/ai/streamedDecisionMessage';
import type {GovernedAiCallResult} from './governedAiCall';
/** Default real composition. No dependency-injection argument is exposed to the
 * Agent or workspace; protected acceptance and all normal runtime gates apply. */
export async function resolveCustomerHostedGovernedAiCall(organizationId:string,preferredProvider:string|undefined,userId:string,preferredModel?:string,streaming?:{abortSignal:AbortSignal;onDraft:(message:string)=>void;beforeAdmission?:()=>Promise<void>}):Promise<GovernedAiCallResult>{
 if(!userId||readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE)!=='offline')return {ok:false,error:'workspace_ai_provider_unavailable'};
 const scope={organizationId,actorId:userId,preferredProvider,preferredModel};
 const readCurrent=createCustomerHostedCurrentReader(scope,{db:prisma});
 try{denyIsolatedExternalIO();await readCurrent()}catch{return {ok:false,error:'workspace_ai_provider_unavailable'}}
 const repository=createCustomerHostedTokenRepository(prisma as unknown as CustomerHostedSqlRepository);
 const store=createCustomerHostedTokenStore(repository,async org=>{
  if(readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE)!=='offline'||org!==organizationId)return null;
  const config=parseCustomerHostedOperatorConfig(process.env.AXIOM_LOCAL_MODEL_CONFIG),budget=config?.budgets.find(b=>b.organizationId===org);
  if(!config||!budget)return null;
  // No second database connection while holding the workspace ledger lock.
  // The store checks these endpoints against its own transaction clock.
  return {digest:config.digest,windowId:budget.windowId,limitTokens:budget.limitTokens,startsAt:Date.parse(budget.startsAt),expiresAt:Date.parse(budget.expiresAt)};
 });
 return {ok:true,extract:async<T>(text:string,schemaHint:string,correlationId:string)=>{
  const extract=createCustomerHostedExtraction(scope,{readCurrent,store,send:sendCustomerHostedCompletion,
   // readCurrent already performs a joined accepted-membership/policy check.
   assertActor:async()=>{await readCurrent()},
   audit:async detail=>{await record({organizationId:id.organization(organizationId),actorUserId:id.user(userId),actorKind:'user',action:detail.outcome==='confirmed'?'copilot.query':'copilot.blocked',outcome:detail.outcome==='confirmed'?'success':'blocked',entityRef:'customer_hosted_model',correlationId:id.correlation(correlationId),source:'live',detail:{provider:'customer_hosted',...detail}})},
  },streaming?.abortSignal,streaming?.beforeAdmission);
  try{return await extract<T>(text,schemaHint,correlationId)}catch{streaming?.abortSignal.throwIfAborted();throw new AgentStreamInterrupted()}
 }};
}
