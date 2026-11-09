/**
 * Tamper-evident audit seal kernel (A11). Pure and deterministic.
 *
 * A seal fingerprints every audit event in a time window (eventsRoot) and links
 * to the previous seal (prevSealHash), so the seals form a hash chain:
 *   sealHash_n = H("axiom-audit-seal-v1", org, n, from, to, count, eventsRoot_n, sealHash_{n-1})
 * Verification recomputes each window from the events that exist now. An edited,
 * deleted or back-dated inserted event changes eventsRoot. Rewriting a seal
 * breaks the chain unless every later seal is rewritten too, which an external
 * copy of the latest sealHash (export, ticket, customer record) will expose.
 * This is tamper EVIDENCE, not tamper prevention.
 */
import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface SealableEvent {
  id: string; kind: string; subjectKind: string; subjectId: string; outcome: string; summary: string;
  actorUserId: string | null; correlationId: string | null; detailJson: unknown; createdAt: Date;
}
export interface SealRecord {
  organizationId: string; sequence: number; fromCreatedAt: Date; toCreatedAt: Date;
  eventCount: number; eventsRoot: string; prevSealHash: string; sealHash: string;
}

/** Stable JSON: object keys sorted recursively, so equal data always hashes equally. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function eventDigest(e: SealableEvent): string {
  return sha(canonicalJson([e.id, e.kind, e.subjectKind, e.subjectId, e.outcome, e.summary, e.actorUserId, e.correlationId, e.detailJson ?? null, e.createdAt.toISOString()]));
}

/** Rolling root over events ordered by (createdAt, id); order is fixed here, not by the caller. */
export function eventsRoot(events: readonly SealableEvent[]): string {
  const ordered = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ordered.reduce((acc, e) => sha(`${acc}:${eventDigest(e)}`), GENESIS_HASH);
}

export function sealHash(s: Omit<SealRecord, "sealHash">): string {
  return sha(canonicalJson(["axiom-audit-seal-v1", s.organizationId, s.sequence, s.fromCreatedAt.toISOString(), s.toCreatedAt.toISOString(), s.eventCount, s.eventsRoot, s.prevSealHash]));
}

export function buildSeal(input: { organizationId: string; previous: SealRecord | null; toCreatedAt: Date; events: readonly SealableEvent[]; genesisFrom: Date }): SealRecord {
  const fromCreatedAt = input.previous ? input.previous.toCreatedAt : input.genesisFrom;
  const base = { organizationId: input.organizationId, sequence: (input.previous?.sequence ?? 0) + 1, fromCreatedAt, toCreatedAt: input.toCreatedAt, eventCount: input.events.length, eventsRoot: eventsRoot(input.events), prevSealHash: input.previous?.sealHash ?? GENESIS_HASH };
  return { ...base, sealHash: sealHash(base) };
}

export type SealVerdict =
  | { sequence: number; status: "intact" }
  | { sequence: number; status: "events_changed"; expectedCount: number; actualCount: number }
  | { sequence: number; status: "seal_altered" }
  | { sequence: number; status: "chain_broken" };

/**
 * Verifies seals in sequence order against the events now in each window.
 * `eventsFor(seal)` must return events with fromCreatedAt < createdAt <= toCreatedAt.
 */
export function verifySeals(seals: readonly SealRecord[], eventsFor: (s: SealRecord) => readonly SealableEvent[]): { intact: boolean; verdicts: SealVerdict[]; latestSealHash: string | null } {
  const ordered = [...seals].sort((a, b) => a.sequence - b.sequence);
  const verdicts: SealVerdict[] = [];
  let prev: SealRecord | null = null;
  for (const s of ordered) {
    const expectedPrev = prev ? prev.sealHash : GENESIS_HASH;
    if (s.sequence !== (prev?.sequence ?? 0) + 1 || s.prevSealHash !== expectedPrev || (prev && s.fromCreatedAt.getTime() !== prev.toCreatedAt.getTime())) verdicts.push({ sequence: s.sequence, status: "chain_broken" });
    else if (sealHash(s) !== s.sealHash) verdicts.push({ sequence: s.sequence, status: "seal_altered" });
    else {
      const events = eventsFor(s);
      if (events.length !== s.eventCount || eventsRoot(events) !== s.eventsRoot) verdicts.push({ sequence: s.sequence, status: "events_changed", expectedCount: s.eventCount, actualCount: events.length });
      else verdicts.push({ sequence: s.sequence, status: "intact" });
    }
    prev = s;
  }
  return { intact: verdicts.every((v) => v.status === "intact"), verdicts, latestSealHash: ordered.at(-1)?.sealHash ?? null };
}

/** Events newer than this are left for the next seal, so in-flight writes are not cut off. */
export const SEAL_GRACE_MS = 2 * 60 * 1000;
