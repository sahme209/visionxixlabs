import { createHash } from "node:crypto";
import type { PublicAllowanceCandidate } from "./publicSubscriptionAllowance";
import type { PublicEnrollment } from "./publicBillingStore";
export type PublicCreditPart = { source: "included"; bucketId: string; maxCents: number } | { source: "purchase"; purchaseId: string; maxCents: number };
export type PublicCreditAttribution = { policy: "axiom_public_anniversary_v1"; reservationId: string; organizationId: string; enrollmentId: string; bucketId: string; windowStart: string; windowEnd: string; admittedAt: string; parts: PublicCreditPart[]; digest: string };
export type PublicCreditHold = { codingHold?: boolean; id: string; organizationId: string; reservedCents: number; settledCents: number | null; status: string; createdAt: Date; expiresAt: Date; usageEventId: string | null; attribution: PublicCreditAttribution | null; linkedUsageId: string | null; usageOrg: string | null; usageBilledCents: number | null; usageBillingStatus: string | null };
export type PublicCreditPurchase = { id: string; organizationId: string; status: string; deliveredAICreditsCents: number; reversedAICreditsCents: number; validFor: string; periodMonth: string; refundedAt: Date | null; createdAt: Date };
export function canonicalPublicJson(value: unknown): string {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,x])=>[k,normalize(x)])) : v;
  return JSON.stringify(normalize(value));
}
const digest = (v: unknown) => createHash("sha256").update(canonicalPublicJson(v)).digest("hex");
const cents = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const validDate = (d: unknown): d is Date => d instanceof Date && Number.isFinite(d.getTime());
const deny = (message = "public_credit_evidence_unavailable"): never => { throw Error(message); };
const partKey = (p: PublicCreditPart) => p.source === "included" ? `i:${p.bucketId}` : `p:${p.purchaseId}`;
export function makePublicCreditAttribution(reservationId: string, w: PublicAllowanceCandidate, parts: PublicCreditPart[], now: Date): PublicCreditAttribution {
  if (!reservationId || !validDate(now) || now < new Date(w.start) || now >= new Date(w.end) || !parts.length || parts.length > 101) deny();
  if (parts.some((p,index) => !cents(p.maxCents) || p.maxCents < 1 || p.source === "included" && (index !== 0 || p.bucketId !== w.bucketId || p.maxCents > w.includedCents) || !["included","purchase"].includes(p.source))) deny();
  if (new Set(parts.map(partKey)).size !== parts.length) deny();
  const body = { policy: "axiom_public_anniversary_v1" as const, reservationId, organizationId: w.organizationId, enrollmentId: w.enrollmentId, bucketId: w.bucketId, windowStart: w.start, windowEnd: w.end, admittedAt: now.toISOString(), parts: structuredClone(parts) };
  return { ...body, digest: digest(body) };
}
/** Projection only. Caller must hold the current enrollment/purchase authority
 * locks and write a reservation plus immutable attribution in one transaction. */
export function allocatePublicCredits(enrollment: PublicEnrollment, w: PublicAllowanceCandidate, holds: PublicCreditHold[], purchases: PublicCreditPurchase[], now: Date, reserveCents = 0) {
  if (!validDate(now) || !cents(reserveCents) || !cents(w.includedCents) || w.enrollmentId !== enrollment.id || w.organizationId !== enrollment.organizationId
    || now < new Date(w.start) || now >= new Date(w.end) || holds.length > 4096 || purchases.length > 100 || new Set(holds.map(h=>h.id)).size !== holds.length || new Set(purchases.map(p=>p.id)).size !== purchases.length) deny();
  const used = new Map<string,number>(), held = new Map<string,number>(), purchaseMap = new Map(purchases.map(p=>[p.id,p]));
  const add = (map: Map<string,number>,key: string,n: number) => { const total=(map.get(key)??0)+n;if(!cents(total))deny();map.set(key,total); };
  const seenUsage = new Set<string>();
  for (const h of holds) {
    if (h.organizationId !== enrollment.organizationId || !cents(h.reservedCents) || h.reservedCents<1 || !validDate(h.createdAt) || !validDate(h.expiresAt)) deny();
    const a=h.attribution;
    if (!a) { if (["reserved","dispatch_unknown","pending_settlement"].includes(h.status)) deny("legacy_ai_reconciliation_required"); continue; }
    const { digest: storedDigest,...body }=a;
    if (storedDigest!==digest(body) || a.policy!==enrollment.policy || a.enrollmentId!==enrollment.id || a.organizationId!==enrollment.organizationId || a.reservationId!==h.id || a.admittedAt!==h.createdAt.toISOString()
      || !Array.isArray(a.parts) || !a.parts.length || a.parts.length>101 || new Set(a.parts.map(partKey)).size!==a.parts.length
      || !Number.isFinite(Date.parse(a.windowStart)) || !Number.isFinite(Date.parse(a.windowEnd)) || h.createdAt<new Date(a.windowStart) || h.createdAt>=new Date(a.windowEnd)) deny();
    let total=0;
    for(const p of a.parts) {
      if(!cents(p.maxCents)||p.maxCents<1||p.source==='included'&&p.bucketId!==a.bucketId||p.source==='purchase'&&!purchaseMap.has(p.purchaseId)||!['included','purchase'].includes(p.source))deny();
      total+=p.maxCents;
    }
    if(!cents(total)||total!==h.reservedCents||!['reserved','dispatch_unknown','pending_settlement','settled','released','expired'].includes(h.status))deny();
    if(h.usageEventId) {
      if(seenUsage.has(h.usageEventId)||h.linkedUsageId!==h.usageEventId||h.usageOrg!==h.organizationId)deny();seenUsage.add(h.usageEventId);
    } else if(h.linkedUsageId!==null)deny();
    if(h.status==='settled') {
      if(!h.usageEventId||h.usageBillingStatus!=='settled'||!cents(h.settledCents)||h.settledCents>h.reservedCents||h.usageBilledCents!==h.settledCents)deny();
      let remaining=h.settledCents as number;
      for(const p of a.parts){const amount=Math.min(p.maxCents,remaining);add(used,partKey(p),amount);remaining-=amount;}
    } else if(h.settledCents!==null)deny();
    if(h.status==='pending_settlement') {if(!h.usageEventId||h.usageBillingStatus!=='pending'||h.usageBilledCents!==0)deny();}
    else if(h.status!=='settled'&&h.usageEventId)deny();
    if(h.status==='dispatch_unknown'||h.status==='pending_settlement'||h.status==='reserved'&&(h.codingHold===true||h.expiresAt>now))for(const p of a.parts)add(held,partKey(p),p.maxCents);
  }
  const initialFreeUsed=w.planId==='free'&&w.start.slice(0,7)===enrollment.legacyFreeMonth?enrollment.legacyFreeUsedCents:0;
  if(!cents(initialFreeUsed))deny();
  let usedCents=(used.get(`i:${w.bucketId}`)??0)+initialFreeUsed,heldCents=held.get(`i:${w.bucketId}`)??0;
  const includedRemaining=Math.max(0,w.includedCents-usedCents-heldCents);
  let addOnCents=0,addOnRemaining=0;
  const eligible: Array<{purchase:PublicCreditPurchase;remaining:number}>=[];
  for(const p of purchases){
    if(p.organizationId!==enrollment.organizationId||!cents(p.deliveredAICreditsCents)||!cents(p.reversedAICreditsCents)||p.reversedAICreditsCents>p.deliveredAICreditsCents||!validDate(p.createdAt)||!['pending','paid','partially_refunded','refunded','expired','failed'].includes(p.status)||!['current_month','permanent'].includes(p.validFor))deny();
    const applicable=['paid','partially_refunded'].includes(p.status)&&(p.validFor==='current_month'?p.periodMonth===now.toISOString().slice(0,7):p.refundedAt===null);
    if(!applicable)continue;
    const net=p.deliveredAICreditsCents-p.reversedAICreditsCents,spent=used.get(`p:${p.id}`)??0,reserved=held.get(`p:${p.id}`)??0,remaining=Math.max(0,net-spent-reserved);
    addOnCents+=net;addOnRemaining+=remaining;usedCents+=spent;heldCents+=reserved;eligible.push({purchase:p,remaining});
  }
  const remainingCents=includedRemaining+addOnRemaining;
  if(![addOnCents,usedCents,heldCents,remainingCents].every(cents))deny();
  if(reserveCents>remainingCents)deny('ai_credit_pool_exhausted');
  const parts:PublicCreditPart[]=[];let needed=reserveCents;
  const included=Math.min(needed,includedRemaining);if(included){parts.push({source:'included',bucketId:w.bucketId,maxCents:included});needed-=included;}
  eligible.sort((a,b)=>(a.purchase.validFor==='current_month'?0:1)-(b.purchase.validFor==='current_month'?0:1)||a.purchase.createdAt.getTime()-b.purchase.createdAt.getTime()||a.purchase.id.localeCompare(b.purchase.id));
  for(const {purchase:p,remaining} of eligible){const amount=Math.min(needed,remaining);if(amount){parts.push({source:'purchase',purchaseId:p.id,maxCents:amount});needed-=amount;}}
  const capacity:Record<string,number>={[`i:${w.bucketId}`]:includedRemaining};
  for(const {purchase:p,remaining} of eligible)capacity[`p:${p.id}`]=remaining;
  return {baseCents:w.includedCents,addOnCents,poolCents:w.includedCents+addOnCents,usedCents,heldCents,remainingCents,parts,capacity};
}
