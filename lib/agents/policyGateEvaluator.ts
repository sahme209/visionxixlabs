/**
 * Pure policy-gate agent evaluator.
 *
 * Walks a tenant's policy rules over a proposed change and decides
 * pass / fail / unknown. Rules are declarative + composable; this
 * module is the engine that runs them. Pure / deterministic.
 */

export type PolicyRuleKind =
  | "require_tag"
  | "forbid_action"
  | "max_blast_radius"
  | "require_role"
  | "require_signed_terraform";

export interface PolicyRule {
  id: string;
  kind: PolicyRuleKind;
  /** Inputs vary by rule kind. */
  args: Record<string, unknown>;
  reason: string;
}

export interface PolicyContext {
  /** Change being evaluated. */
  proposedActions: readonly string[];      // e.g. "s3:PutBucketAcl"
  affectedTags: Record<string, string>;     // tags on the resource(s) post-change
  blastRadius: "single_resource" | "service" | "account" | "org";
  approverRoles: readonly string[];         // roles ready to approve
  terraformSigned: boolean;
}

export interface PolicyEvalRow {
  ruleId: string;
  passed: boolean;
  detail: string;
}

export interface PolicyVerdict {
  rows: PolicyEvalRow[];
  passedCount: number;
  failedCount: number;
  overall: "pass" | "fail";
}

const RADIUS_RANK: Record<PolicyContext["blastRadius"], number> = {
  single_resource: 1, service: 2, account: 3, org: 4,
};

function evalRule(rule: PolicyRule, ctx: PolicyContext): PolicyEvalRow {
  switch (rule.kind) {
    case "require_tag": {
      const key = String(rule.args.key ?? "");
      const present = key.length > 0 && (ctx.affectedTags[key] ?? "").length > 0;
      return { ruleId: rule.id, passed: present, detail: present ? `tag ${key} present` : `tag ${key} missing` };
    }
    case "forbid_action": {
      const action = String(rule.args.action ?? "");
      const hit = ctx.proposedActions.some((a) => a === action);
      return { ruleId: rule.id, passed: !hit, detail: hit ? `forbidden action ${action} present` : `${action} not used` };
    }
    case "max_blast_radius": {
      const max = String(rule.args.max ?? "service") as PolicyContext["blastRadius"];
      const allowed = RADIUS_RANK[ctx.blastRadius] <= (RADIUS_RANK[max] ?? 0);
      return { ruleId: rule.id, passed: allowed, detail: allowed ? `radius ${ctx.blastRadius} ≤ ${max}` : `radius ${ctx.blastRadius} > ${max}` };
    }
    case "require_role": {
      const role = String(rule.args.role ?? "");
      const ok = ctx.approverRoles.includes(role);
      return { ruleId: rule.id, passed: ok, detail: ok ? `role ${role} present` : `role ${role} missing` };
    }
    case "require_signed_terraform": {
      return { ruleId: rule.id, passed: ctx.terraformSigned, detail: ctx.terraformSigned ? "terraform plan signed" : "terraform plan unsigned" };
    }
  }
}

export function evaluatePolicy(rules: readonly PolicyRule[], ctx: PolicyContext): PolicyVerdict {
  const rows = rules.map((r) => evalRule(r, ctx));
  const passedCount = rows.filter((r) => r.passed).length;
  const failedCount = rows.length - passedCount;
  return { rows, passedCount, failedCount, overall: failedCount === 0 ? "pass" : "fail" };
}
