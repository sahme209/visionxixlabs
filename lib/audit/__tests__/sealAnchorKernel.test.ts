import { describe, expect, it } from "vitest";
import { ANCHOR_SCHEMA, buildSealAnchor, checkSealAnchor, parseSealAnchor } from "../sealAnchorKernel";

const h = (c: string) => c.repeat(64);
const seal = { organizationId: "org_1", sequence: 3, sealHash: h("a"), prevSealHash: h("b"), eventCount: 12, toCreatedAt: new Date("2026-11-09T10:00:00Z") };
const chain = [{ sequence: 1, sealHash: h("c") }, { sequence: 2, sealHash: h("b") }, { sequence: 3, sealHash: h("a") }, { sequence: 4, sealHash: h("d") }];
const anchor = buildSealAnchor(seal, new Date("2026-11-09T12:00:00Z"));

describe("audit seal anchors", () => {
  it("builds a stable, content-free anchor", () => {
    expect(anchor).toMatchObject({ schema: ANCHOR_SCHEMA, organizationId: "org_1", sequence: 3, sealHash: h("a"), eventCount: 12, toCreatedAt: "2026-11-09T10:00:00.000Z" });
    expect(anchor.anchorDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(buildSealAnchor(seal, new Date("2026-11-09T12:00:00Z"))).toEqual(anchor);
    expect(Object.keys(anchor).sort()).toEqual(["anchorDigest", "eventCount", "exportedAt", "organizationId", "prevSealHash", "schema", "sealHash", "sequence", "toCreatedAt"]);
  });

  it("matches the live chain and counts later seals", () => {
    expect(checkSealAnchor(JSON.parse(JSON.stringify(anchor)), "org_1", chain)).toEqual({ status: "matches", sequence: 3, laterSeals: 1 });
  });

  it("detects a rewritten or removed seal", () => {
    expect(checkSealAnchor(anchor, "org_1", chain.map((s) => (s.sequence === 3 ? { ...s, sealHash: h("e") } : s)))).toEqual({ status: "hash_mismatch", sequence: 3 });
    expect(checkSealAnchor(anchor, "org_1", chain.filter((s) => s.sequence !== 3))).toEqual({ status: "seal_missing", sequence: 3 });
  });

  it("refuses an anchor from another workspace", () => {
    expect(checkSealAnchor(anchor, "org_2", chain)).toEqual({ status: "other_workspace" });
  });

  it("refuses an edited, malformed or unknown-schema file", () => {
    expect(parseSealAnchor({ ...anchor, eventCount: 13 })).toEqual({ ok: false, reason: "digest" });
    expect(parseSealAnchor({ ...anchor, sealHash: h("e") })).toEqual({ ok: false, reason: "digest" });
    expect(parseSealAnchor({ ...anchor, schema: "axiom.audit-anchor/2" })).toEqual({ ok: false, reason: "schema" });
    expect(parseSealAnchor({ ...anchor, sequence: 0 })).toEqual({ ok: false, reason: "shape" });
    expect(parseSealAnchor({ ...anchor, sealHash: "not-hex" })).toEqual({ ok: false, reason: "shape" });
    for (const bad of [null, [], "x", 1]) expect(parseSealAnchor(bad)).toEqual({ ok: false, reason: "shape" });
  });

  it("ignores extra fields instead of trusting them", () => {
    const parsed = parseSealAnchor({ ...anchor, injected: "<script>" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.anchor).not.toHaveProperty("injected");
  });
});
