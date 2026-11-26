/**
 * Automatic review triage by blast radius (agentic automation priority 3). Pure.
 *
 * Every agent request is sorted into a review lane the moment it arrives, with a one-line reason, so
 * reviewers spend attention where the blast radius is: contained changes are approved by policy or get
 * a quick look, risky ones a careful review, and production changes that are wide or touch sensitive
 * areas need two different people. Triage can only add review, never remove what policy requires.
 */
import type { ImpactPreview } from "@/lib/impact/impactKernel";
import type { ActionKind, GatewayEnvironment, PolicyResult } from "./policyKernel";

export type ReviewLane = "auto" | "quick" | "careful" | "two_person" | "refused";
export interface Triage { lane: ReviewLane; approvalsRequired: 0 | 1 | 2; reason: string }
export const LANE_LABEL: Record<ReviewLane, string> = { auto: "Allowed by policy", quick: "Quick look", careful: "Careful review", two_person: "Two approvers", refused: "Refused by policy" };

const PROD_TWO_PERSON_KINDS: ReadonlySet<ActionKind> = new Set(["data_migration", "delete_resource", "infra_change"]);
const SENSITIVE = new Set(["database_migration", "auth_security", "secrets_config", "infrastructure", "ci_cd"]);

export function triageRequest(input: { actionKind: ActionKind; environment: GatewayEnvironment; policy: Pick<PolicyResult, "decision" | "riskLevel">; impact: ImpactPreview | null }): Triage {
  const { policy, impact, environment, actionKind } = input;
  if (policy.decision === "deny") return { lane: "refused", approvalsRequired: 0, reason: "Policy refuses this action; it cannot be approved." };
  if (policy.decision === "allow") return { lane: "auto", approvalsRequired: 0, reason: "Low risk and contained, so policy allows it without review." };
  const sensitive = (impact?.areas ?? []).map((a) => a.area).filter((a) => SENSITIVE.has(a));
  const prod = environment === "production";
  if (prod && (impact?.blastRadius === "wide" || sensitive.length > 0 || PROD_TWO_PERSON_KINDS.has(actionKind))) {
    const why = impact?.blastRadius === "wide" ? `touches ${impact.files} files across many areas` : sensitive.length ? `touches ${sensitive.map((a) => a.replace(/_/g, " ")).join(", ")}` : `is a ${actionKind.replace(/_/g, " ")}`;
    return { lane: "two_person", approvalsRequired: 2, reason: `A production change that ${why}: two different admins must approve.` };
  }
  if (policy.riskLevel === "high" || prod || impact?.blastRadius === "moderate" || sensitive.length > 0) {
    return { lane: "careful", approvalsRequired: 1, reason: prod ? "Production change: read the summary and files before approving." : impact?.blastRadius === "moderate" ? `Moderate blast radius across ${impact.files} files.` : "High-risk action outside production." };
  }
  return { lane: "quick", approvalsRequired: 1, reason: impact ? `Contained change to ${impact.files} file${impact.files === 1 ? "" : "s"} outside production.` : "Medium-risk action outside production with no file changes listed." };
}
