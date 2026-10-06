import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdvisorInputs } from "../releaseAdvisorEngine";

const mocks = vi.hoisted(() => ({
  makeInstrumentedFetcher: vi.fn(),
}));

vi.mock("../instrumentedAiFetcher", () => ({
  makeInstrumentedFetcher: mocks.makeInstrumentedFetcher,
}));

import { parseAiVoteResponse, makeAiNativeVoterAsync, __clearAiVoterCache } from "../aiNativeAdvisorVoter";

function makeInput(): AdvisorInputs {
  return {
    release: { id: "rel-1", status: "ready", releaseTag: "v1.0.0", commitSha: "abc123", plannedWindowStart: null, plannedWindowEnd: null },
    readiness: null,
    policyViolations: { blocking: 0, warning: 0, advisory: 0 },
    pendingManualFixes: { total: 0, inProd: 0 },
    recentIncidents: { open: 0, openCritical: 0, mitigated: 0 },
    branchProtection: { snapshotsTotal: 1, weakOrNone: 0, forcePushAllowedOnMain: false },
    previousReleaseStatus: "deployed",
    hasEvidencePack: false,
    isInPlannedFreeze: false,
    now: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("makeAiNativeVoterAsync — cache is scoped per organization", () => {
  beforeEach(() => {
    __clearAiVoterCache();
    mocks.makeInstrumentedFetcher.mockReset();
    mocks.makeInstrumentedFetcher.mockImplementation(() =>
      vi.fn(async () => ({ text: `{"kind":"proceed","confidence":80,"rationale":"ok"}` })),
    );
  });

  it("does not share a cached vote across two different organizations with identical input", async () => {
    const input = makeInput();
    const voteA = await makeAiNativeVoterAsync("org-a")(input);
    const voteB = await makeAiNativeVoterAsync("org-b")(input);

    expect(voteA.kind).toBe("proceed");
    expect(voteB.kind).toBe("proceed");
    // Each org's first call must hit the AI fetcher independently —
    // if the cache key omitted organizationId, org-b would get org-a's
    // cached vote on a second call without ever reaching the fetcher,
    // skipping org-b's own workspace AI policy/budget/audit enforcement.
    expect(mocks.makeInstrumentedFetcher).toHaveBeenCalledTimes(2);
    expect(mocks.makeInstrumentedFetcher).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a" }));
    expect(mocks.makeInstrumentedFetcher).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-b" }));
  });

  it("does reuse the cache for the same organization with identical input", async () => {
    const input = makeInput();
    await makeAiNativeVoterAsync("org-a")(input);
    await makeAiNativeVoterAsync("org-a")(input);

    expect(mocks.makeInstrumentedFetcher).toHaveBeenCalledTimes(1);
  });
});

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
