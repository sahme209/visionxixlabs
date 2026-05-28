import { describe, expect, it } from "vitest";
import { parseAiVoteResponse } from "../aiNativeAdvisorVoter";

describe("parseAiVoteResponse", () => {
  it("parses a clean JSON response", () => {
    const out = parseAiVoteResponse(`{"kind":"block_deploy","confidence":85,"rationale":"critical risk detected"}`);
    expect(out).toEqual({
      kind: "block_deploy",
      confidence: 85,
      rationale: "critical risk detected",
    });
  });

  it("extracts JSON when wrapped in prose (defensive parsing)", () => {
    const out = parseAiVoteResponse(`Here is my answer:\n{"kind":"proceed","confidence":80,"rationale":"clear to go"}\nHope this helps.`);
    expect(out?.kind).toBe("proceed");
    expect(out?.confidence).toBe(80);
  });

  it("rejects invalid kinds", () => {
    expect(parseAiVoteResponse(`{"kind":"yolo","confidence":50,"rationale":"x"}`)).toBeNull();
  });

  it("rejects responses without a rationale", () => {
    expect(parseAiVoteResponse(`{"kind":"proceed","confidence":80}`)).toBeNull();
    expect(parseAiVoteResponse(`{"kind":"proceed","confidence":80,"rationale":""}`)).toBeNull();
  });

  it("clamps confidence into [0, 100]", () => {
    const high = parseAiVoteResponse(`{"kind":"proceed","confidence":9999,"rationale":"x"}`);
    const low = parseAiVoteResponse(`{"kind":"proceed","confidence":-5,"rationale":"x"}`);
    expect(high?.confidence).toBe(100);
    expect(low?.confidence).toBe(0);
  });

  it("accepts numeric confidence as string", () => {
    const out = parseAiVoteResponse(`{"kind":"proceed","confidence":"75","rationale":"x"}`);
    expect(out?.confidence).toBe(75);
  });

  it("returns null on completely unparseable input", () => {
    expect(parseAiVoteResponse(`yes, definitely proceed`)).toBeNull();
    expect(parseAiVoteResponse(``)).toBeNull();
  });

  it("returns null on JSON that's missing required fields", () => {
    expect(parseAiVoteResponse(`{"kind":"proceed"}`)).toBeNull();
    expect(parseAiVoteResponse(`{}`)).toBeNull();
  });

  it("trims surrounding whitespace in rationale", () => {
    const out = parseAiVoteResponse(`{"kind":"proceed","confidence":80,"rationale":"   spaced   "}`);
    expect(out?.rationale).toBe("spaced");
  });

  it("accepts every valid recommendation kind", () => {
    const kinds = [
      "block_deploy", "rollback", "needs_evidence", "propose_freeze",
      "proceed_with_caution", "propose_manual_fix_log",
      "propose_branch_protection_strengthen", "proceed",
    ];
    for (const k of kinds) {
      const out = parseAiVoteResponse(`{"kind":"${k}","confidence":75,"rationale":"x"}`);
      expect(out?.kind).toBe(k);
    }
  });
});
