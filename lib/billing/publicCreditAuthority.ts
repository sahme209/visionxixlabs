import "server-only";
import { randomUUID } from "node:crypto";
import { lockPublicOrganization, readPublicContract, readPublicEnrollment, type PublicSql } from "./publicBillingStore";
import { publicFreeAllowanceCandidate, publicPaidAllowanceCandidate, type PublicPaidAllowanceBasis } from "./publicSubscriptionAllowance";
import { allocatePublicCredits, makePublicCreditAttribution, type PublicCreditHold, type PublicCreditPurchase } from "./publicCreditAllocation";
import type { PublicBillingIdentity } from "./publicCheckoutService";
import type { CurrentAIAllowance } from "./currentAIAllowance";
import type { AICreditReservationResult } from "./aiCreditReservation";

export async function publicDatabaseNow(tx: PublicSql): Promise<Date> {
  const rows=await tx.$queryRawUnsafe<Array<{now:Date}>>("SELECT date_trunc('milliseconds',clock_timestamp()) AS now");
  const now=rows[0]?.now;if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('public_clock_unavailable');return now;
}
export async function publicBillingWindow(tx: PublicSql, organizationId: string, identity: PublicBillingIdentity, now: Date) {
  const enrollment=await readPublicEnrollment(tx,organizationId);
  if(!enrollment)return null;
  if(enrollment.accountId!==identity.accountId||enrollment.livemode!==identity.livemode)throw Error('public_billing_identity_mismatch');
  const contract=await readPublicContract(tx,organizationId);
  if(!contract){
    const window=publicFreeAllowanceCandidate({policy:enrollment.policy,enrollmentId:enrollment.id,organizationId},now);
    if(window.kind!=='public_allowance_candidate')return {available:false as const,enrollment,contract};
    return {available:true as const,enrollment,contract,window};
  }
  const b=contract.binding;
  if(contract.enrollmentId!==enrollment.id||b.accountId!==identity.accountId||b.livemode!==identity.livemode||b.organizationId!==organizationId||contract.status!=='active'||!contract.coverage)return {available:false as const,enrollment,contract};
  const basis:PublicPaidAllowanceBasis={policy:enrollment.policy,enrollmentId:enrollment.id,organizationId,accountId:b.accountId,contractId:b.contractId,subscriptionId:b.subscriptionId,planId:b.planId,interval:b.interval,paidSeats:b.paidSeats,priceId:b.priceId,unitAmountCents:b.unitAmountCents,anchor:contract.anchor,originalCreateProofDigest:b.originalCreateProofDigest,firstCollectionDigest:contract.firstCollectionDigest};
  const originals=await tx.$queryRawUnsafe<Array<{body:unknown}>>('SELECT body FROM "PublicInvoiceCollection" WHERE "organizationId"=$1 AND digest=$2',organizationId,contract.firstCollectionDigest);
  const original=originals[0]?.body as Record<string,unknown>|undefined;
  if(originals.length!==1||!original||original.serviceStart!==contract.anchor||original.originalCreateProofDigest!==b.originalCreateProofDigest||original.contractId!==b.contractId||original.accountId!==b.accountId||original.livemode!==b.livemode)throw Error('public_original_collection_unverified');
  const window=publicPaidAllowanceCandidate(basis,contract.coverage,now,identity.livemode);
  if(window.kind!=='public_allowance_candidate')return {available:false as const,enrollment,contract};
  const receipt=await tx.$queryRawUnsafe<Array<{digest:string;organizationId:string}>>('SELECT digest,"organizationId" FROM "PublicInvoiceCollection" WHERE "invoiceId"=$1',contract.coverage.invoiceId);
  if(receipt.length!==1||receipt[0].organizationId!==organizationId||receipt[0].digest!==contract.coverage.evidenceDigest)throw Error('public_collection_evidence_unavailable');
  return {available:true as const,enrollment,contract,window};
}
async function facts(tx:PublicSql,org:string,lock=false){
  const holds=await tx.$queryRawUnsafe<PublicCreditHold[]>(`SELECT EXISTS(SELECT 1 FROM "PipelineAICallReservation" c WHERE c."workspaceReservationId"=h.id AND c."organizationId"=h."organizationId") AS "codingHold",h.id,h."organizationId",h."reservedCents",h."settledCents",h.status,h."createdAt" AT TIME ZONE 'UTC' AS "createdAt",h."expiresAt" AT TIME ZONE 'UTC' AS "expiresAt",h."usageEventId",a.body AS attribution,u.id AS "linkedUsageId",u."organizationId" AS "usageOrg",u."billedCents" AS "usageBilledCents",u."billingStatus" AS "usageBillingStatus"
    FROM "AIUsageReservation" h LEFT JOIN "PublicCreditAttribution" a ON a."reservationId"=h.id LEFT JOIN "UsageEvent" u ON u.id=h."usageEventId" WHERE h."organizationId"=$1 ORDER BY h."createdAt" DESC LIMIT 4097`,org);
  const purchases=await tx.$queryRawUnsafe<PublicCreditPurchase[]>(`SELECT id,"organizationId",status,"deliveredAICreditsCents","reversedAICreditsCents","validFor","periodMonth","refundedAt" AT TIME ZONE 'UTC' AS "refundedAt","createdAt" AT TIME ZONE 'UTC' AS "createdAt" FROM "AddOnPurchase" WHERE "organizationId"=$1 ORDER BY "createdAt",id LIMIT 101${lock?' FOR SHARE':''}`,org);
  return {holds,purchases};
}
export async function readPublicCreditAllowance(tx:PublicSql,org:string,identity:PublicBillingIdentity,now:Date):Promise<CurrentAIAllowance|undefined>{
  const state=await publicBillingWindow(tx,org,identity,now);if(!state)return undefined;if(!state.available)return {available:false};
  const f=await facts(tx,org),a=allocatePublicCredits(state.enrollment,state.window,f.holds,f.purchases,now);
  return {available:true,baseCents:a.baseCents,addOnCents:a.addOnCents,poolCents:a.poolCents,usedCents:a.usedCents,heldCents:a.heldCents,includedRemainingCents:a.remainingCents,overagePolicy:'hard_stop'};
}
export async function reservePublicCredits(tx:PublicSql,input:{organizationId:string;idempotencyKey:string;reservedCents:number;correlationId?:string},identity:PublicBillingIdentity,now:Date):Promise<AICreditReservationResult|undefined>{
  await lockPublicOrganization(tx,input.organizationId);
  const state=await publicBillingWindow(tx,input.organizationId,identity,now);if(!state)return undefined;
  if(!state.available)return {ok:false,error:'ai_credit_reservation_unavailable'};
  if(!/^[A-Za-z0-9_-]{16,200}$/.test(input.idempotencyKey)||!Number.isSafeInteger(input.reservedCents)||input.reservedCents<1)throw Error('public_credit_request_invalid');
  const memberCount=await tx.$queryRawUnsafe<Array<{seats:number}>>('SELECT count(*)::integer AS seats FROM "OrgMembership" WHERE "organizationId"=$1 AND "acceptedAt" IS NOT NULL',input.organizationId);
  if(!memberCount[0]||memberCount[0].seats>state.window.seats)return {ok:false,error:'ai_credit_reservation_unavailable'};
  const existing=await tx.$queryRawUnsafe<Array<{id:string;organizationId:string;idempotencyKey:string;reservedCents:number;status:string;expiresAt:Date}>>(`SELECT id,"organizationId","idempotencyKey","reservedCents",status,"expiresAt" AT TIME ZONE 'UTC' AS "expiresAt" FROM "AIUsageReservation" WHERE "organizationId"=$1 AND "idempotencyKey"=$2`,input.organizationId,input.idempotencyKey);
  if(existing[0]){
    if(existing[0].reservedCents!==input.reservedCents)return {ok:false,error:'idempotency_key_conflict'};
    const receipt=await tx.$queryRawUnsafe<unknown[]>('SELECT "reservationId" FROM "PublicCreditAttribution" WHERE "reservationId"=$1 AND "organizationId"=$2',existing[0].id,input.organizationId);
    if(receipt.length!==1)throw Error('public_credit_attribution_missing');
    return {ok:true,reservation:existing[0],reused:true,allocationPolicy:'axiom_public_anniversary_v1'};
  }
  const f=await facts(tx,input.organizationId,true);
  let a:ReturnType<typeof allocatePublicCredits>;
  try{a=allocatePublicCredits(state.enrollment,state.window,f.holds,f.purchases,now,input.reservedCents);}catch(error){if(error instanceof Error&&error.message==='ai_credit_pool_exhausted')return {ok:false,error:'ai_credit_pool_exhausted'};throw error;}
  const id=randomUUID(),expiresAt=new Date(now.getTime()+300000),attribution=makePublicCreditAttribution(id,state.window,a.parts,now);
  await tx.$executeRawUnsafe(`INSERT INTO "AIUsageReservation" (id,"organizationId","idempotencyKey","reservedCents",status,"expiresAt","createdAt","updatedAt","correlationId") VALUES ($1,$2,$3,$4,'reserved',$5::timestamptz AT TIME ZONE 'UTC',$6::timestamptz AT TIME ZONE 'UTC',$6::timestamptz AT TIME ZONE 'UTC',$7)`,id,input.organizationId,input.idempotencyKey,input.reservedCents,expiresAt.toISOString(),now.toISOString(),input.correlationId??null);
  await tx.$executeRawUnsafe('INSERT INTO "PublicCreditAttribution" ("reservationId","organizationId",body) VALUES ($1,$2,$3::jsonb)',id,input.organizationId,JSON.stringify(attribution));
  return {ok:true,reservation:{id,...input,status:'reserved',expiresAt},reused:false,allocationPolicy:'axiom_public_anniversary_v1'};
}
export async function claimPublicCreditDispatch(tx:PublicSql,scope:{organizationId:string;userId:string},reservationId:string,identity:PublicBillingIdentity,now:Date):Promise<boolean>{
  await lockPublicOrganization(tx,scope.organizationId);
  const members=await tx.$queryRawUnsafe<unknown[]>('SELECT "userId" FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 AND "acceptedAt" IS NOT NULL FOR SHARE',scope.organizationId,scope.userId);
  if(members.length!==1)return false;
  const state=await publicBillingWindow(tx,scope.organizationId,identity,now);if(!state?.available)return false;
  const seats=await tx.$queryRawUnsafe<Array<{seats:number}>>('SELECT count(*)::integer AS seats FROM "OrgMembership" WHERE "organizationId"=$1 AND "acceptedAt" IS NOT NULL',scope.organizationId);
  if(!seats[0]||seats[0].seats>state.window.seats)return false;
  const f=await facts(tx,scope.organizationId,true),hold=f.holds.find(h=>h.id===reservationId);
  if(!hold||hold.status!=='reserved'||hold.usageEventId!==null||hold.expiresAt<=now||hold.attribution?.bucketId!==state.window.bucketId)return false;
  allocatePublicCredits(state.enrollment,state.window,f.holds,f.purchases,now);
  const available=allocatePublicCredits(state.enrollment,state.window,f.holds.filter(h=>h.id!==reservationId),f.purchases,now);
  if(hold.attribution.parts.some(p=>p.maxCents>(available.capacity[p.source==='included'?`i:${p.bucketId}`:`p:${p.purchaseId}`]??0)))return false;
  const updated=await tx.$queryRawUnsafe<Array<{id:string}>>(`UPDATE "AIUsageReservation" SET status='dispatch_unknown',"updatedAt"=$3::timestamptz AT TIME ZONE 'UTC' WHERE id=$1 AND "organizationId"=$2 AND status='reserved' AND "usageEventId" IS NULL AND "expiresAt">$3::timestamptz AT TIME ZONE 'UTC' RETURNING id`,reservationId,scope.organizationId,now.toISOString());
  return updated.length===1&&updated[0].id===reservationId;
}
