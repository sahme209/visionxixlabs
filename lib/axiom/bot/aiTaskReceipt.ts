import {AI_TASK_LIMITS} from './aiTaskContract';
import type {AiTaskAccountingEvidence} from './aiTaskLifecycle';
export interface AiTaskReceiptBinding {organizationId:string;userId:string;correlationId:string;modelId:string;reservationKey:string;dispatchClaimedAt:Date}
interface Hold {id:string;organizationId:string;idempotencyKey:string;correlationId:string|null;reservedCents:number;status:string;usageEventId:string|null;createdAt:Date}
interface Usage {id:string;organizationId:string;triggeredBy:string|null;correlationId:string|null;provider:string|null;model:string|null;eventKind:string;externalUsageId:string|null;inputTokens:number;outputTokens:number;cachedReadTokens:number;billingStatus:string;createdAt:Date}
const holdSelect={id:true,organizationId:true,idempotencyKey:true,correlationId:true,reservedCents:true,status:true,usageEventId:true,createdAt:true} as const;
const usageSelect={id:true,organizationId:true,triggeredBy:true,correlationId:true,provider:true,model:true,eventKind:true,externalUsageId:true,inputTokens:true,outputTokens:true,cachedReadTokens:true,billingStatus:true,createdAt:true} as const;
export interface AiTaskReceiptTransaction {
 aIUsageReservation:{findFirst(args:{where:{organizationId:string;idempotencyKey:string};select:typeof holdSelect}):Promise<Hold|null>};
 usageEvent:{findFirst(args:{where:{id:string;organizationId:string};select:typeof usageSelect}):Promise<Usage|null>};
}
export interface AiTaskReceiptRepo {$transaction<T>(fn:(tx:AiTaskReceiptTransaction)=>Promise<T>):Promise<T>}
/** Read-only billing proof. Does not settle, debit, reserve, refund or retry.
 * Caller computes the reservation key using governedExtractReservationKey.
 * Model-generated receipt strings and client-selected keys are never authority. */
export async function verifyAiTaskReceipt(repo:AiTaskReceiptRepo,b:AiTaskReceiptBinding,at=new Date()):Promise<AiTaskAccountingEvidence>{
 const refuse=():never=>{throw new Error('ai_task_usage_receipt_unverified')};
 const validId=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=1024;
 if(![b.organizationId,b.userId,b.correlationId,b.modelId,b.reservationKey].every(validId)||!Number.isFinite(at.getTime())||!Number.isFinite(b.dispatchClaimedAt.getTime())||b.dispatchClaimedAt>at)return refuse();
 const within=(date:Date)=>date instanceof Date&&Number.isFinite(date.getTime())&&date>=b.dispatchClaimedAt&&date<=at;
 return repo.$transaction(async tx=>{
  const hold=await tx.aIUsageReservation.findFirst({where:{organizationId:b.organizationId,idempotencyKey:b.reservationKey},select:holdSelect});
  if(!hold||!validId(hold.id)||hold.organizationId!==b.organizationId||hold.idempotencyKey!==b.reservationKey||hold.correlationId!==b.correlationId||!['pending_settlement','settled'].includes(hold.status)||!validId(hold.usageEventId)||!Number.isSafeInteger(hold.reservedCents)||hold.reservedCents<1||hold.reservedCents>AI_TASK_LIMITS.maxReservationCents||!within(hold.createdAt))return refuse();
  const usage=await tx.usageEvent.findFirst({where:{id:hold.usageEventId,organizationId:b.organizationId},select:usageSelect});
  if(!usage||usage.id!==hold.usageEventId||usage.organizationId!==b.organizationId||usage.triggeredBy!==b.userId||usage.correlationId!==b.correlationId||usage.provider!=='vercel_gateway'||usage.model!==b.modelId||usage.eventKind!=='ai_invocation'||!validId(usage.externalUsageId)||!['pending','settled'].includes(usage.billingStatus)||(hold.status==='settled'&&usage.billingStatus!=='settled')||![usage.inputTokens,usage.outputTokens,usage.cachedReadTokens].every(n=>Number.isSafeInteger(n)&&n>=0)||usage.outputTokens>AI_TASK_LIMITS.maxOutputTokens||!within(usage.createdAt))return refuse();
  return Object.freeze({usageReceiptId:usage.id,organizationId:b.organizationId,userId:b.userId,correlationId:b.correlationId,modelId:b.modelId});
 });
}
