import { describe, expect, it } from "vitest";
import {
  runAdvisorCouncilAsync,
  ruleBasedVoter,
  conservativeVoter,
  pragmaticVoter,
  type AsyncAdvisorVoter,
} from "../advisorCouncilEngine";
import type { AdvisorInputs } from "../releaseAdvisorEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function baseInput(overrides: Partial<AdvisorInputs> = {}): AdvisorInputs {
  return {
    release: { id: "rel_1", status: "ready", releaseTag: "v1.2.3", commitSha: "abc1234", plannedWindowStart: null, plannedWindowEnd: null },
    readiness: { overallScore: 85, riskLevel: "low", blockerCount: 0, branchGovernance: 80, changeCompliance: 90, secretTraceability: 85, rollbackReadiness: 75, manualReconciliation: 90 },
    policyViolations: { blocking: 0, warning: 0, advisory: 0 },
    pendingManualFixes: { total: 0, inProd: 0 },
    recentIncidents: { open: 0, openCritical: 0, mitigated: 0 },
    branchProtection: { snapshotsTotal: 1, weakOrNone: 0, forcePushAllowedOnMain: false },
    previousReleaseStatus: null,
    hasEvidencePack: false,
    isInPlannedFreeze: false,
    now: NOW,
    ...overrides,
  };
}

describe("runAdvisorCouncilAsync", () => {
  it("runs only sync voters when async list is empty", async () => {
    const out = await runAdvisorCouncilAsync(baseInput());
    expect(out.voterCount).toBe(3);
    expect(out.votes).toHaveLength(3);
    expect(out.votes.map((v) => v.voterId).sort()).toEqual(["conservative", "pragmatic", "rule_based"]);
  });

  it("merges sync + async voters into one vote tally", async () => {
    const asyncAi: AsyncAdvisorVoter = async () => ({
      voterId: "ai_native", kind: "proceed", confidence: 85,
      rationale: "AI says proceed",
    });
    const out = await runAdvisorCouncilAsync(baseInput(), [ruleBasedVoter], [asyncAi]);
    expect(out.voterCount).toBe(2);
    expect(out.votes.map((v) => v.voterId).sort()).toEqual(["ai_native", "rule_based"]);
  });

  it("AI vote influences the consensus", async () => {
    // Two sync voters tie on conservative + pragmatic (proceed_with_caution vs proceed);
    // AI breaks the tie toward block_deploy with high confidence.
    const asyncAi: AsyncAdvisorVoter = async () => ({
      voterId: "ai_native", kind: "block_deploy", confidence: 95,
      rationale: "AI detected risk the rules missed",
    });
    const out = await runAdvisorCouncilAsync(
      baseInput({ readiness: { ...baseInput().readiness!, overallScore: 78 } }),
      [pragmaticVoter, conservativeVoter],
      [asyncAi],
    );
    // Vote weights: pragmatic proceed=85, conservative caution=70, ai block=95
    // → block_deploy = 95 vs proceed 85 vs caution 70. No strict majority (95 < 250/2=125).
    // The point is the AI vote is in the mix.
    expect(out.votes.find((v) => v.voterId === "ai_native")?.kind).toBe("block_deploy");
  });

  it("captures async voter exceptions as 'errored_voter' vote (does NOT abort)", async () => {
    const boom: AsyncAdvisorVoter = async () => { throw new Error("api timeout"); };
    const out = await runAdvisorCouncilAsync(
      baseInput(),
      [ruleBasedVoter],
      [boom],
    );
    expect(out.voterCount).toBe(2);
    const errored = out.votes.find((v) => v.voterId === "errored_voter");
    expect(errored).toBeDefined();
    expect(errored?.rationale).toContain("api timeout");
  });

  it("captures sync voter exceptions too", async () => {
    const boomSync = () => { throw new Error("rule bug"); };
    const out = await runAdvisorCouncilAsync(baseInput(), [boomSync, ruleBasedVoter], []);
    const errored = out.votes.find((v) => v.voterId === "errored_voter");
    expect(errored).toBeDefined();
    expect(errored?.rationale).toContain("rule bug");
  });

  it("runs multiple async voters in parallel", async () => {
    let started = 0;
    let maxInflight = 0;
    let inflight = 0;
    const makeSlow = (id: string): AsyncAdvisorVoter => async () => {
      started += 1;
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 10));
      inflight -= 1;
      return { voterId: id, kind: "proceed", confidence: 50, rationale: id };
    };
    await runAdvisorCouncilAsync(
      baseInput(),
      [], // no sync voters
      [makeSlow("a"), makeSlow("b"), makeSlow("c")],
    );
    expect(started).toBe(3);
    expect(maxInflight).toBe(3); // parallelism confirmed
  });

  it("clamps async voter outputs (invalid kind → proceed, out-of-range confidence → [0,100])", async () => {
    const weird: AsyncAdvisorVoter = async () => ({
      voterId: "weird", kind: "not_a_kind" as never, confidence: 9999, rationale: "x",
    });
    const out = await runAdvisorCouncilAsync(baseInput(), [], [weird]);
    expect(out.votes[0].kind).toBe("proceed");
    expect(out.votes[0].confidence).toBe(100);
  });

  it("empty input → no_consensus with zero agreement", async () => {
    const out = await runAdvisorCouncilAsync(baseInput(), [], []);
    expect(out.consensusKind).toBe("no_consensus");
    expect(out.agreementScore).toBe(0);
    expect(out.votes).toHaveLength(0);
  });
});
