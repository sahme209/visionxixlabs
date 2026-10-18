import { createHash } from "node:crypto";
import { ANNIVERSARY_POLICY_V2, createAllowanceBasisV2, validateAllowanceWindowV2, type AllowanceBasisV2, type AllowanceWindowV2 } from "./anniversaryWindow";
export type CeilingV2 = { source: "included"; bucketId: string; maxCents: number } | { source: "purchase"; purchaseId: string; maxCents: number };
export type SpendV2 = { source: "included"; bucketId: string; cents: number } | { source: "purchase"; purchaseId: string; cents: number };
export type ReservationAttributionV2 = { version: 2; policy: "axiom_test_anniversary_v2"; runtimeId: string; accountId: string; organizationId: string; enrollmentDigest: string; basisDigest: string; bucketId: string; kind: "free" | "paid"; windowStart: string; windowEnd: string; admittedAt: string; allocation: CeilingV2[]; digest: string };
export type UsageAttributionV2 = Omit<ReservationAttributionV2, "policy" | "runtimeId" | "accountId" | "organizationId" | "digest" | "allocation"> & { reservationId: string; attributionDigest: string } & ({ state: "pending"; allocation?: never } | { state: "settled"; allocation: SpendV2[] });
export type PurchaseV2 = { id: string; organizationId: string; deliveredAICreditsCents: number; reversedAICreditsCents: number; status: string; validFor: string; periodMonth: string; refundedAt: Date | null; createdAt: Date };
export type HoldV2 = { id: string; organizationId: string; reservedCents: number; settledCents: number | null; status: string; expiresAt: Date; usageEventId: string | null; attribution: ReservationAttributionV2 | null };
export type UsageV2 = { id: string; organizationId: string; billedCents: number; billingStatus: string; metadata: unknown };
export type AllocationFactsV2 = { bases: AllowanceBasisV2[]; holds: HoldV2[]; usage: UsageV2[]; purchases: PurchaseV2[] };

function deny(code = "allocation_unavailable"): never { throw new Error(code); }
const cents = (n: number) => Number.isSafeInteger(n) && n >= 0;
const hash = (body: unknown) => createHash("sha256").update(JSON.stringify(body)).digest("hex");
export function sameAllocationJSON(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => [k, canonical(value)])) : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export function createReservationAttributionV2(basis: AllowanceBasisV2, window: AllowanceWindowV2, at: Date, allocation: CeilingV2[]): ReservationAttributionV2 {
  if (!validateAllowanceWindowV2(basis, window) || !(at instanceof Date) || !Number.isFinite(at.getTime()) || at < new Date(window.start) || at >= new Date(window.end) || !Array.isArray(allocation) || !allocation.length || allocation.length > 101) deny();
  const ids = new Set<string>(); let total = 0;
  const normalized = allocation.map(a => {
    if (!a || !cents(a.maxCents) || a.maxCents < 1) deny();
    const id = a.source === "included" ? `included:${a.bucketId}` : a.source === "purchase" ? `purchase:${a.purchaseId}` : deny();
    if (ids.has(id) || a.source === "included" && (a.bucketId !== window.bucketId || a.maxCents > window.includedCents) || a.source === "purchase" && (typeof a.purchaseId !== "string" || !a.purchaseId.trim())) deny();
    ids.add(id); total += a.maxCents;
    return a.source === "included" ? { source: a.source, bucketId: a.bucketId, maxCents: a.maxCents } : { source: a.source, purchaseId: a.purchaseId, maxCents: a.maxCents };
  });
  if (!cents(total) || total < 1 || normalized.some((a, index) => a.source === "included" && index !== 0)) deny();
  const body = { version: 2 as const, policy: ANNIVERSARY_POLICY_V2, runtimeId: basis.runtimeId, accountId: basis.accountId, organizationId: basis.organizationId, enrollmentDigest: basis.enrollmentDigest, basisDigest: basis.digest, bucketId: window.bucketId, kind: basis.kind, windowStart: window.start, windowEnd: window.end, admittedAt: at.toISOString(), allocation: normalized };
  return { ...body, digest: hash(body) };
}
export function validateReservationAttributionV2(bases: AllowanceBasisV2[], attribution: ReservationAttributionV2): AllowanceBasisV2 {
  const basis = bases.find(b => b.digest === attribution?.basisDigest); if (!basis) deny();
  const window: AllowanceWindowV2 = { version: 2, policy: ANNIVERSARY_POLICY_V2, basisDigest: basis.digest, bucketId: attribution.bucketId, kind: attribution.kind, start: attribution.windowStart, end: attribution.windowEnd, includedCents: basis.kind === "free" ? 200 : basis.terms.monthlyAICreditsCents };
  const canonical = createReservationAttributionV2(basis, window, new Date(attribution.admittedAt), attribution.allocation);
  if (!sameAllocationJSON(canonical, attribution)) deny();
  return basis;
}
export function usageAttributionV2(id: string, a: ReservationAttributionV2, actual: number | null): UsageAttributionV2 {
  if (!id || actual !== null && (!cents(actual) || actual > a.allocation.reduce((s, c) => s + c.maxCents, 0))) deny();
  const common = { version: 2 as const, reservationId: id, attributionDigest: a.digest, enrollmentDigest: a.enrollmentDigest, basisDigest: a.basisDigest, bucketId: a.bucketId, kind: a.kind, windowStart: a.windowStart, windowEnd: a.windowEnd, admittedAt: a.admittedAt };
  if (actual === null) return { ...common, state: "pending" };
  let remaining = actual;
  const allocation: SpendV2[] = [];
  for (const c of a.allocation) { const amount = Math.min(c.maxCents, remaining); if (amount) allocation.push(c.source === "included" ? { source: "included", bucketId: c.bucketId, cents: amount } : { source: "purchase", purchaseId: c.purchaseId, cents: amount }); remaining -= amount; }
  return { ...common, state: "settled", allocation };
}
export function eligiblePurchaseV2(p: PurchaseV2, now: Date): boolean {
  return ["paid", "partially_refunded"].includes(p.status) && (p.validFor === "current_month" ? p.periodMonth === now.toISOString().slice(0, 7) : p.validFor === "permanent" && p.refundedAt === null);
}
/** Full bounded fact sets, not aggregates. Every AI row must have original
 * attribution. The return is a projection/funding candidate, never a balance. */
export function resolveAllocationV2(basis: AllowanceBasisV2, window: AllowanceWindowV2, facts: AllocationFactsV2, now: Date, reserveCents = 0): { available: true; remainingCents: number; baseCents: number; addOnCents: number; usedCents: number; heldCents: number; allocation: CeilingV2[]; selectedPurchases: PurchaseV2[] } {
  if (!validateAllowanceWindowV2(basis, window) || !(now instanceof Date) || !Number.isFinite(now.getTime()) || now < new Date(window.start) || now >= new Date(window.end) || !cents(reserveCents)
    || !facts || facts.holds.length > 4096 || facts.usage.length > 4096 || facts.purchases.length > 100 || facts.bases.length > 2) deny();
  const scope = (v: { organizationId: string }) => { if (v.organizationId !== basis.organizationId) deny(); };
  const unique = (ids: string[]) => { if (ids.some(id => !id) || new Set(ids).size !== ids.length) deny(); };
  unique(facts.holds.map(h => h.id)); unique(facts.usage.map(u => u.id)); unique(facts.purchases.map(p => p.id)); unique(facts.bases.map(b => b.digest));
  for (const b of facts.bases) if (b.organizationId !== basis.organizationId || b.runtimeId !== basis.runtimeId || b.accountId !== basis.accountId || b.enrollmentDigest !== basis.enrollmentDigest || createAllowanceBasisV2(b).digest !== b.digest) deny();
  if (!facts.bases.some(b => b.digest === basis.digest)) deny();
  const purchaseMap = new Map(facts.purchases.map(p => [p.id, p]));
  for (const p of facts.purchases) { scope(p); if (!cents(p.deliveredAICreditsCents) || !cents(p.reversedAICreditsCents) || p.reversedAICreditsCents > p.deliveredAICreditsCents || !["pending", "paid", "partially_refunded", "refunded", "expired", "failed"].includes(p.status) || !["current_month", "permanent"].includes(p.validFor) || !/^\d{4}-\d{2}$/.test(p.periodMonth) || !(p.createdAt instanceof Date) || !Number.isFinite(p.createdAt.getTime()) || p.refundedAt !== null && (!(p.refundedAt instanceof Date) || !Number.isFinite(p.refundedAt.getTime()))) deny(); }
  const used = new Map<string, number>(), held = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, n: number) => { const total = (map.get(key) ?? 0) + n; if (!cents(total)) deny(); map.set(key, total); };
  const key = (a: SpendV2 | CeilingV2) => a.source === "included" ? `i:${a.bucketId}` : `p:${a.purchaseId}`;
  const matched = new Set<string>();
  for (const h of facts.holds) {
    scope(h); const a = h.attribution; if (!a || !cents(h.reservedCents) || h.reservedCents < 1 || !(h.expiresAt instanceof Date) || !Number.isFinite(h.expiresAt.getTime())) deny();
    validateReservationAttributionV2(facts.bases, a); scope(a);
    if (a.allocation.reduce((s, c) => s + c.maxCents, 0) !== h.reservedCents || a.allocation.some(c => c.source === "purchase" && !purchaseMap.has(c.purchaseId))) deny();
    if (!["reserved", "dispatch_unknown", "pending_settlement", "settled", "released", "expired"].includes(h.status)) deny();
    const u = h.usageEventId ? facts.usage.find(u => u.id === h.usageEventId) : null;
    if (h.usageEventId && !u || (h.status === "pending_settlement" || h.status === "settled") && !u || h.status === "reserved" && u || ["released", "expired", "dispatch_unknown"].includes(h.status) && u) deny();
    if (u) {
      scope(u); if (matched.has(u.id) || !cents(u.billedCents) || (h.status === "settled" ? u.billingStatus !== "settled" || h.settledCents !== u.billedCents : u.billingStatus !== "pending" || u.billedCents !== 0 || h.settledCents !== null)) deny();
      const receipt = usageAttributionV2(h.id, a, h.status === "settled" ? u.billedCents : null);
      const metadata = u.metadata && typeof u.metadata === "object" && !Array.isArray(u.metadata) ? u.metadata as Record<string, unknown> : null;
      if (!metadata || !sameAllocationJSON(metadata.axiomTestAllocationV2, receipt)) deny();
      matched.add(u.id);
      if (receipt.state === "settled") for (const c of receipt.allocation) add(used, key(c), c.cents);
    } else if (h.settledCents !== null) deny();
    const active = h.status === "dispatch_unknown" || h.status === "pending_settlement" || h.status === "reserved" && h.expiresAt > now;
    if (active) for (const c of a.allocation) add(held, key(c), c.maxCents);
  }
  if (matched.size !== facts.usage.length) deny();
  const includedUsed = used.get(`i:${window.bucketId}`) ?? 0, includedHeld = held.get(`i:${window.bucketId}`) ?? 0;
  const included = Math.max(0, window.includedCents - includedUsed - includedHeld);
  let addOnCents = 0, usedCents = includedUsed, heldCents = includedHeld;
  const purchases = facts.purchases.filter(p => eligiblePurchaseV2(p, now)).sort((a, b) => (a.validFor === "current_month" ? 0 : 1) - (b.validFor === "current_month" ? 0 : 1) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const remaining = new Map<string, number>();
  for (const p of purchases) { const spent = used.get(`p:${p.id}`) ?? 0, reserved = held.get(`p:${p.id}`) ?? 0, n = Math.max(0, p.deliveredAICreditsCents - p.reversedAICreditsCents - spent - reserved); remaining.set(p.id, n); addOnCents += n; usedCents += spent; heldCents += reserved; }
  const remainingCents = included + addOnCents; if (![remainingCents, usedCents, heldCents].every(cents)) deny();
  if (reserveCents > remainingCents) deny("ai_credit_pool_exhausted");
  let request = reserveCents; const allocation: CeilingV2[] = [], selectedPurchases: PurchaseV2[] = [];
  const first = Math.min(included, request); if (first) { allocation.push({ source: "included", bucketId: window.bucketId, maxCents: first }); request -= first; }
  for (const p of purchases) { const amount = Math.min(remaining.get(p.id)!, request); if (amount) { allocation.push({ source: "purchase", purchaseId: p.id, maxCents: amount }); selectedPurchases.push(p); request -= amount; } }
  return { available: true, remainingCents, baseCents: window.includedCents, addOnCents, usedCents, heldCents, allocation, selectedPurchases };
}
