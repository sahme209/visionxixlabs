/**
 * Audit seal anchors (A9.8 decision 7: "the latest seal fingerprint is exported
 * outside the deployment"). Pure.
 *
 * Seals chain each window of audit events to the previous seal, so anyone who
 * can rewrite the database could also rebuild the whole chain. An anchor is a
 * small file with the latest seal's fingerprint that the customer keeps
 * somewhere Axiom cannot write (a ticket, a vault, an email to auditors).
 * Later, checking that anchor against the live chain proves the history up to
 * it has not been rewritten. The anchor contains no event content.
 */
import { createHash } from "node:crypto";
import { canonicalJson, type SealRecord } from "./sealKernel";

export const ANCHOR_SCHEMA = "axiom.audit-anchor/1" as const;

export interface SealAnchor {
  schema: typeof ANCHOR_SCHEMA;
  organizationId: string;
  sequence: number;
  sealHash: string;
  prevSealHash: string;
  eventCount: number;
  toCreatedAt: string;
  exportedAt: string;
  /** sha256 over the canonical JSON of every other field; catches edits to the file itself. */
  anchorDigest: string;
}

type AnchorBody = Omit<SealAnchor, "anchorDigest">;
const digestOf = (body: AnchorBody) => createHash("sha256").update(canonicalJson(body)).digest("hex");

export function buildSealAnchor(seal: Pick<SealRecord, "organizationId" | "sequence" | "sealHash" | "prevSealHash" | "eventCount" | "toCreatedAt">, exportedAt: Date): SealAnchor {
  const body: AnchorBody = {
    schema: ANCHOR_SCHEMA,
    organizationId: seal.organizationId,
    sequence: seal.sequence,
    sealHash: seal.sealHash,
    prevSealHash: seal.prevSealHash,
    eventCount: seal.eventCount,
    toCreatedAt: seal.toCreatedAt.toISOString(),
    exportedAt: exportedAt.toISOString(),
  };
  return { ...body, anchorDigest: digestOf(body) };
}

export type AnchorCheck =
  | { status: "matches"; sequence: number; laterSeals: number }
  | { status: "invalid_anchor"; reason: "schema" | "shape" | "digest" }
  | { status: "other_workspace" }
  | { status: "seal_missing"; sequence: number }
  | { status: "hash_mismatch"; sequence: number };

const HEX64 = /^[0-9a-f]{64}$/;

/** Parses untrusted JSON (a file the customer kept) into an anchor, or says why not. */
export function parseSealAnchor(raw: unknown): { ok: true; anchor: SealAnchor } | { ok: false; reason: "schema" | "shape" | "digest" } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "shape" };
  const a = raw as Record<string, unknown>;
  if (a.schema !== ANCHOR_SCHEMA) return { ok: false, reason: "schema" };
  const shapeOk = typeof a.organizationId === "string" && a.organizationId.length > 0 && a.organizationId.length <= 200
    && Number.isSafeInteger(a.sequence) && (a.sequence as number) >= 1
    && typeof a.sealHash === "string" && HEX64.test(a.sealHash)
    && typeof a.prevSealHash === "string" && a.prevSealHash.length <= 128
    && Number.isSafeInteger(a.eventCount) && (a.eventCount as number) >= 0
    && typeof a.toCreatedAt === "string" && !Number.isNaN(Date.parse(a.toCreatedAt))
    && typeof a.exportedAt === "string" && !Number.isNaN(Date.parse(a.exportedAt))
    && typeof a.anchorDigest === "string" && HEX64.test(a.anchorDigest);
  if (!shapeOk) return { ok: false, reason: "shape" };
  const { anchorDigest, ...rest } = a as unknown as SealAnchor;
  const body: AnchorBody = { schema: ANCHOR_SCHEMA, organizationId: rest.organizationId, sequence: rest.sequence, sealHash: rest.sealHash, prevSealHash: rest.prevSealHash, eventCount: rest.eventCount, toCreatedAt: rest.toCreatedAt, exportedAt: rest.exportedAt };
  if (digestOf(body) !== anchorDigest) return { ok: false, reason: "digest" };
  return { ok: true, anchor: { ...body, anchorDigest } };
}

/**
 * Compares a kept anchor with the live seal chain. A match only means the chain
 * still contains that exact seal; run verify to check the events under it.
 */
export function checkSealAnchor(raw: unknown, organizationId: string, seals: readonly Pick<SealRecord, "sequence" | "sealHash">[]): AnchorCheck {
  const parsed = parseSealAnchor(raw);
  if (!parsed.ok) return { status: "invalid_anchor", reason: parsed.reason };
  const { anchor } = parsed;
  if (anchor.organizationId !== organizationId) return { status: "other_workspace" };
  const live = seals.find((s) => s.sequence === anchor.sequence);
  if (!live) return { status: "seal_missing", sequence: anchor.sequence };
  if (live.sealHash !== anchor.sealHash) return { status: "hash_mismatch", sequence: anchor.sequence };
  return { status: "matches", sequence: anchor.sequence, laterSeals: seals.filter((s) => s.sequence > anchor.sequence).length };
}
