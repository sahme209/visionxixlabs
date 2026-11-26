/** IO boundary for the blocking-check gate: reads checks and this commit's results, then evaluates. */
import { MAX_CHECKS_PER_WORKSPACE } from "./deploymentChecks";
import { evaluateStageGate, type GateCheck, type GateOutcome, type GateResult } from "./deploymentCheckGate";

export interface DeploymentCheckGateRepo {
  deploymentCheck: { findMany(args: { where: { organizationId: string; enabled: true; mode: "blocking" }; take: number; select: Record<string, true> }): Promise<GateCheck[]> };
  deploymentCheckResult: { findMany(args: { where: { organizationId: string; releaseRef: string; checkKey: { in: string[] } }; orderBy: { reportedAt: "desc" }; take: number; select: Record<string, true> }): Promise<GateResult[]> };
}

/** Fails closed: if checks or results cannot be read, the caller must not proceed. */
export async function readDeploymentCheckGate(repo: DeploymentCheckGateRepo, input: { organizationId: string; commitSha: string; now: Date }): Promise<GateOutcome | "unavailable"> {
  try {
    const checks = await repo.deploymentCheck.findMany({ where: { organizationId: input.organizationId, enabled: true, mode: "blocking" }, take: MAX_CHECKS_PER_WORKSPACE, select: { key: true, name: true, kind: true, stage: true, mode: true, enabled: true, version: true } });
    if (checks.length === 0) return { ok: true, satisfied: [], notEnforceable: [] };
    const results = await repo.deploymentCheckResult.findMany({ where: { organizationId: input.organizationId, releaseRef: input.commitSha, checkKey: { in: checks.map((c) => c.key) } }, orderBy: { reportedAt: "desc" }, take: 500, select: { checkKey: true, checkVersion: true, status: true, releaseRef: true, reportedAt: true } });
    return evaluateStageGate({ checks, results, startingStage: "deploy", commitSha: input.commitSha, now: input.now });
  } catch {
    return "unavailable";
  }
}
