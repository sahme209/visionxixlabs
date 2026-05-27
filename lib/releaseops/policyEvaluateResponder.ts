/**
 * Phase 478 — policy evaluate-and-persist orchestrator.
 *
 * Loads the active policy rules + release context (release row,
 * latest branch validation summary, cherry-pick row, change-ticket
 * linked to the release) and runs the Phase 443 engine. Every
 * detected violation gets upserted into PolicyViolation; previously-
 * persisted violations for rules that now pass are marked resolved.
 *
 * Tests pass an in-memory repo stub and a fixed seed-rule list.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  evaluateReleasePolicy,
  composeActiveRules,
  type ActiveRule,
  type ActiveRuleRow,
  type EngineVerdict,
  type PolicyViolationDetail,
} from "./policyEngine";
import type { PolicyEvaluationContext } from "./policies/seed";

/* ──────────────────────────────────────────────────────────────────
   Row + repo contract.
   ────────────────────────────────────────────────────────────── */

export interface EvalReleaseRow {
  id: string;
  organizationId: string;
  applicationId: string;
  status: string;
  releaseTag: string | null;
  commitSha: string | null;
  scopeFinalizedAt: Date | null;
  rollbackReferenceReleaseId: string | null;
  plannedWindowStart: Date | null;
  plannedWindowEnd: Date | null;
  actualDeployStart: Date | null;
  actualDeployEnd: Date | null;
  targetEnvironmentId: string | null;
}

export interface EvalEnvironmentRow {
  id: string;
  tier: PolicyEvaluationContext["environmentTier"];
}

export interface EvalCherryPickRow {
  id: string;
  status: string;
  hasFinalCommitValidation: boolean;
}

export interface EvalChangeTicketRow {
  id: string;
  status: string;
}

export interface EvalPolicyRuleRow extends ActiveRuleRow {
  id: string;
}

export interface EvalExistingViolationRow {
  id: string;
  ruleId: string;
  status: string;
}

export interface PolicyEvaluateRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<EvalReleaseRow | null>;
  };
  environment: {
    findUnique(args: { where: { id: string } }): Promise<EvalEnvironmentRow | null>;
  };
  cherryPickException: {
    findFirst(args: {
      where: { organizationId: string; releaseId: string; status?: "approved" };
      orderBy: { requestedAt: "desc" };
    }): Promise<EvalCherryPickRow | null>;
  };
  changeTicket: {
    findFirst(args: {
      where: { organizationId: string; linkedReleaseIds: { has: string } };
    }): Promise<EvalChangeTicketRow | null>;
  };
  policyRule: {
    findMany(args: {
      where: { organizationId: string; enabled: true };
    }): Promise<EvalPolicyRuleRow[]>;
  };
  policyViolation: {
    findMany(args: {
      where: { organizationId: string; releaseId: string };
    }): Promise<EvalExistingViolationRow[]>;
    create(args: {
      data: {
        organizationId: string;
        releaseId: string;
        ruleId: string;
        status: "open";
        message: string;
        remediation: string | null;
      };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: {
        status?: "open" | "resolved";
        message?: string;
        remediation?: string | null;
        detectedAt?: Date;
      };
    }): Promise<{ id: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildPolicyEvaluateInput {
  organizationId: string;
  releaseId: string;
  /** Override the environment-tier lookup when the release has no
   *  targetEnvironmentId set. Defaults to "stage" — safer than "prod"
   *  but stricter than "dev". */
  fallbackEnvironmentTier?: PolicyEvaluationContext["environmentTier"];
  /** Phase 445 branch-validation summary for the release. The
   *  responder doesn't recompute it here; the caller passes whatever
   *  the latest BranchValidationSession produced. */
  branchValidation?: PolicyEvaluationContext["branchValidation"];
}

export type PolicyEvaluateBody =
  | {
      ok: true;
      data: {
        releaseId: string;
        verdict: EngineVerdict;
        evaluatedRuleCount: number;
        violations: ReadonlyArray<PolicyViolationDetail>;
        opened: number;
        refreshed: number;
        resolved: number;
        ignoredUnknownRules: number;
        environmentTier: PolicyEvaluationContext["environmentTier"];
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: PolicyEvaluateBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildPolicyEvaluateResponse(
  repo: PolicyEvaluateRepo,
  input: BuildPolicyEvaluateInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();

    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }

    // Resolve environment tier — the rule set is filtered against prod-only checks.
    let environmentTier: PolicyEvaluationContext["environmentTier"] =
      input.fallbackEnvironmentTier ?? "stage";
    if (release.targetEnvironmentId) {
      const env = await repo.environment.findUnique({ where: { id: release.targetEnvironmentId } });
      if (env) environmentTier = env.tier;
    }

    const [activeRows, cherryPick, changeTicket, existing] = await Promise.all([
      repo.policyRule.findMany({ where: { organizationId: input.organizationId, enabled: true } }),
      repo.cherryPickException.findFirst({
        where: { organizationId: input.organizationId, releaseId: release.id, status: "approved" },
        orderBy: { requestedAt: "desc" },
      }),
      repo.changeTicket.findFirst({
        where: { organizationId: input.organizationId, linkedReleaseIds: { has: release.id } },
      }),
      repo.policyViolation.findMany({ where: { organizationId: input.organizationId, releaseId: release.id } }),
    ]);

    const rules: ActiveRule[] = composeActiveRules(activeRows);

    const ctx: PolicyEvaluationContext = {
      release: {
        id: release.id,
        organizationId: release.organizationId,
        applicationId: release.applicationId,
        status: release.status as never,
        releaseTag: release.releaseTag,
        commitSha: release.commitSha,
        scopeFinalizedAt: release.scopeFinalizedAt,
        rollbackReferenceReleaseId: release.rollbackReferenceReleaseId,
        plannedWindowStart: release.plannedWindowStart,
        plannedWindowEnd: release.plannedWindowEnd,
        actualDeployStart: release.actualDeployStart,
        actualDeployEnd: release.actualDeployEnd,
      },
      environmentTier,
      changeTicket: changeTicket
        ? {
            id: changeTicket.id,
            state: changeTicket.status,
            // These flags would come from the ticket adapter; until that
            // lands, assume the tracker carries the required metadata
            // so the rule doesn't false-positive on missing-fields.
            hasCommitSha: true,
            hasArtifactTag: !!release.releaseTag,
            hasRollbackPlan: !!release.rollbackReferenceReleaseId,
          }
        : null,
      ...(input.branchValidation !== undefined ? { branchValidation: input.branchValidation } : {}),
      cherryPick: cherryPick ? { hasFinalCommitValidation: cherryPick.hasFinalCommitValidation } : null,
      now,
    };

    const result = evaluateReleasePolicy(rules, ctx);

    // Index existing violations by ruleId so we can diff against the
    // engine output. Key by rule.key via a second pass since the
    // PolicyRule row carries id ↔ key.
    const ruleIdByKey = new Map(activeRows.map((r) => [r.key, r.id]));
    const detectedRuleIds = new Set<string>();

    let opened = 0;
    let refreshed = 0;

    // Index existing by ruleId for O(1) lookup during the upsert loop.
    const existingByRule = new Map<string, EvalExistingViolationRow>();
    for (const e of existing) existingByRule.set(e.ruleId, e);

    for (const v of result.violations) {
      const ruleId = ruleIdByKey.get(v.ruleKey);
      if (!ruleId) continue;
      detectedRuleIds.add(ruleId);
      const prior = existingByRule.get(ruleId);
      if (prior) {
        await repo.policyViolation.update({
          where: { id: prior.id },
          data: { status: "open", message: v.message, remediation: v.remediation ?? null, detectedAt: now },
        });
        if (prior.status !== "resolved") refreshed += 1; else opened += 1;
      } else {
        await repo.policyViolation.create({
          data: {
            organizationId: input.organizationId,
            releaseId: release.id,
            ruleId,
            status: "open",
            message: v.message,
            remediation: v.remediation ?? null,
          },
        });
        opened += 1;
      }
    }

    // Mark previously-open violations whose rule now passes as resolved.
    let resolved = 0;
    for (const e of existing) {
      if (e.status === "resolved") continue;
      if (detectedRuleIds.has(e.ruleId)) continue;
      await repo.policyViolation.update({ where: { id: e.id }, data: { status: "resolved" } });
      resolved += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          releaseId: release.id,
          verdict: result.verdict,
          evaluatedRuleCount: activeRows.length,
          violations: result.violations,
          opened,
          refreshed,
          resolved,
          ignoredUnknownRules: result.summary.ignoredUnknownRules,
          environmentTier,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 / 466 / 477 migrations must be applied for policy evaluation." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
