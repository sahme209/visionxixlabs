/**
 * Release autopilot (pure). An agent deploy that would wait for review is allowed by policy only when
 * the workspace's reviewed autopilot rule covers it: the environment is one the rule names (development
 * or staging; the schema never admits production), the agent listed the changed files, there are at
 * most the rule's number of them, the blast radius is contained and no sensitive area is touched.
 * Anything else keeps the decision it had. It never loosens a deny or touches other action kinds.
 */
import type { ImpactPreview } from "@/lib/impact/impactKernel";
import type { StoredAutopilot } from "@/lib/releaseops/policyAsCode";
import type { GatewayActionInput, PolicyResult } from "./policyKernel";

const SENSITIVE = new Set(["database_migration", "ci_cd", "auth_security", "secrets_config", "infrastructure"]);

export function applyReleaseAutopilot(policy: PolicyResult, action: Pick<GatewayActionInput, "actionKind" | "environment">, impact: ImpactPreview | null, rule: StoredAutopilot | null): PolicyResult {
  if (!rule || policy.decision !== "require_approval" || action.actionKind !== "deploy") return policy;
  if (action.environment === "production" || !rule.deployEnvironments.includes(action.environment)) return policy;
  if (!impact) return { ...policy, reasons: [...policy.reasons, "Release autopilot needs the changed files, so this deploy waits for review."] };
  const sensitive = impact.areas.some((a) => SENSITIVE.has(a.area));
  if (impact.files > rule.maxFiles || impact.blastRadius !== "contained" || sensitive) {
    return { ...policy, reasons: [...policy.reasons, `Release autopilot does not cover it (${impact.files > rule.maxFiles ? `${impact.files} files, limit ${rule.maxFiles}` : sensitive ? "touches a sensitive area" : `${impact.blastRadius} blast radius`}), so it waits for review.`] };
  }
  return { decision: "allow", riskLevel: policy.riskLevel, reasons: [...policy.reasons, `Allowed by release autopilot: a contained change of ${impact.files} file${impact.files === 1 ? "" : "s"} to ${action.environment}, within the rule two admins approved. The outcome must still be reported.`] };
}
