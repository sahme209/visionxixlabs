import "server-only";
import { prisma } from "@/lib/db";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { buildSeal, SEAL_GRACE_MS, verifySeals, type SealableEvent, type SealRecord } from "./sealKernel";

/** IO boundary for audit seals (A11). Composes the pure seal kernel with Prisma. */
const EVENT_SELECT = { id: true, kind: true, subjectKind: true, subjectId: true, outcome: true, summary: true, actorUserId: true, correlationId: true, detailJson: true, createdAt: true } as const;
const MAX_EVENTS_PER_SEAL = 50_000;
const GENESIS_FROM = new Date(0);

async function eventsIn(organizationId: string, from: Date, to: Date): Promise<SealableEvent[]> {
  return prisma.auditEvent.findMany({ where: { organizationId, createdAt: { gt: from, lte: to } }, select: EVENT_SELECT, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_EVENTS_PER_SEAL + 1 }) as Promise<SealableEvent[]>;
}

/** Seals everything since the last seal, up to now minus a short grace period. No-op if nothing new. */
export async function sealOrganizationAudit(organizationId: string, now = new Date()): Promise<{ ok: true; sealed: SealRecord | null } | { ok: false; error: string }> {
  const previous = await prisma.auditSeal.findFirst({ where: { organizationId }, orderBy: { sequence: "desc" } });
  const to = new Date(now.getTime() - SEAL_GRACE_MS);
  const from = previous?.toCreatedAt ?? GENESIS_FROM;
  if (to.getTime() <= from.getTime()) return { ok: true, sealed: null };
  let events = await eventsIn(organizationId, from, to);
  let upTo = to;
  if (events.length > MAX_EVENTS_PER_SEAL) {
    // Very large backlog: seal in chunks; the next call continues where this one stopped.
    // Cut strictly before the last timestamp so no same-instant event is split across seals.
    const cut = events[MAX_EVENTS_PER_SEAL - 1].createdAt.getTime();
    upTo = new Date(cut - 1);
    events = events.filter((e) => e.createdAt.getTime() <= upTo.getTime());
  }
  if (events.length === 0) return { ok: true, sealed: null };
  const seal = buildSeal({ organizationId, previous, toCreatedAt: upTo, events, genesisFrom: GENESIS_FROM });
  try {
    await prisma.auditSeal.create({ data: seal });
  } catch {
    // Unique (organizationId, sequence): another sealer won the race. Their seal stands.
    return { ok: false, error: "seal_conflict" };
  }
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "audit.sealed", subjectKind: "audit_seal", subjectId: String(seal.sequence), summary: `Sealed ${seal.eventCount} audit events (seal #${seal.sequence})`, detailJson: { sealHash: seal.sealHash } });
  return { ok: true, sealed: seal };
}

/** Recomputes every seal for the organization. Read-only. */
export async function verifyOrganizationAudit(organizationId: string) {
  const seals = await prisma.auditSeal.findMany({ where: { organizationId }, orderBy: { sequence: "asc" }, take: 10_000 });
  const windows = new Map<number, SealableEvent[]>();
  for (const s of seals) windows.set(s.sequence, await eventsIn(organizationId, s.fromCreatedAt, s.toCreatedAt));
  const result = verifySeals(seals, (s) => windows.get(s.sequence) ?? []);
  return { ...result, sealCount: seals.length, checkedAt: new Date().toISOString() };
}
