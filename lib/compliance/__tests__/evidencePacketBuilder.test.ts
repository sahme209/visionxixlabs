/**
 * Vitest unit tests for the pure compliance-evidence-packet builder.
 *
 * The critical invariant is determinism: same inputs → identical
 * integrityHash. Auditors should be able to re-run the build and
 * verify the hash against the one they received.
 */

import { describe, it, expect } from "vitest";
import { buildEvidencePacket, type EvidencePacketInput } from "../evidencePacketBuilder";

const FIXED: EvidencePacketInput = {
  organizationId: "org-1",
  generatedAt: "2026-05-20T12:00:00.000Z",
  windowStart: "2026-05-19T12:00:00.000Z",
  windowEnd: "2026-05-20T12:00:00.000Z",
  busMessages: [
    { id: "m-2", sender: "reasoner", kind: "hypothesis_proposed", summary: "h2", publishedAt: "2026-05-20T11:00:00.000Z" },
    { id: "m-1", sender: "detector", kind: "broadcast_signal", summary: "s1", publishedAt: "2026-05-20T10:00:00.000Z" },
  ],
  proposals: [
    { id: "p-b", authorAgent: "improver", target: "runbook_recipe", status: "approved", label: "B", createdAt: "2026-05-20T09:00:00.000Z" },
    { id: "p-a", authorAgent: "improver", target: "policy_template", status: "pending", label: "A", createdAt: "2026-05-20T08:00:00.000Z" },
  ],
  statusComponents: [
    { name: "z-cron", state: "ok" },
    { name: "a-db", state: "degraded" },
  ],
};

describe("evidence packet builder", () => {
  it("sets schema + safety contract + window correctly", () => {
    const pkt = buildEvidencePacket(FIXED);
    expect(pkt.schema).toBe("axiom.compliance.evidence_packet");
    expect(pkt.schemaVersion).toBe(1);
    expect(pkt.safetyContract).toBe("approval_only_no_execution");
    expect(pkt.window).toEqual({ start: "2026-05-19T12:00:00.000Z", end: "2026-05-20T12:00:00.000Z" });
  });

  it("summarizes bus + proposal + status counts", () => {
    const pkt = buildEvidencePacket(FIXED);
    expect(pkt.summary.busMessageCount).toBe(2);
    expect(pkt.summary.proposalCount).toBe(2);
    expect(pkt.summary.proposalsByStatus).toEqual({ approved: 1, pending: 1 });
    expect(pkt.summary.statusComponents).toBe(2);
    expect(pkt.summary.statusDegradedOrDown).toBe(1);
  });

  it("sorts bus messages by publishedAt asc", () => {
    const pkt = buildEvidencePacket(FIXED);
    expect(pkt.busMessages.map((m) => m.id)).toEqual(["m-1", "m-2"]);
  });

  it("sorts proposals by createdAt asc", () => {
    const pkt = buildEvidencePacket(FIXED);
    expect(pkt.proposals.map((p) => p.id)).toEqual(["p-a", "p-b"]);
  });

  it("sorts status components by name asc", () => {
    const pkt = buildEvidencePacket(FIXED);
    expect(pkt.statusComponents.map((c) => c.name)).toEqual(["a-db", "z-cron"]);
  });

  it("integrityHash is deterministic for identical inputs", () => {
    const a = buildEvidencePacket(FIXED).integrityHash;
    const b = buildEvidencePacket(FIXED).integrityHash;
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("integrityHash changes when content changes", () => {
    const baseline = buildEvidencePacket(FIXED).integrityHash;
    const mutated = buildEvidencePacket({
      ...FIXED,
      busMessages: [...FIXED.busMessages, {
        id: "m-3", sender: "council", kind: "council_consensus", summary: "c", publishedAt: "2026-05-20T11:30:00.000Z",
      }],
    }).integrityHash;
    expect(mutated).not.toBe(baseline);
  });

  it("integrityHash is invariant to input order (canonical sort)", () => {
    const a = buildEvidencePacket(FIXED).integrityHash;
    const b = buildEvidencePacket({
      ...FIXED,
      busMessages: [...FIXED.busMessages].reverse(),
      proposals: [...FIXED.proposals].reverse(),
      statusComponents: [...FIXED.statusComponents].reverse(),
    }).integrityHash;
    expect(a).toBe(b);
  });

  it("uses the default note when none supplied", () => {
    const pkt = buildEvidencePacket(FIXED);
    expect(pkt.note).toMatch(/approval-only-no-execution/i);
  });

  it("respects an operator-supplied note", () => {
    const pkt = buildEvidencePacket({ ...FIXED, note: "SOC2 ev #42" });
    expect(pkt.note).toBe("SOC2 ev #42");
  });
});
