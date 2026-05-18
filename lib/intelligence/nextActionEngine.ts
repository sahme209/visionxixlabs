/**
 * Next-Best-Action Engine.
 *
 * Pure read-only composition. Consumes the canonical PriorityReport
 * (produced by the Priority Engine) and emits a ranked list of
 * NextActionItems classified by safety level.
 *
 * Hard guarantee: this engine cannot emit mutation actions. The
 * mapping from priority category → action type is closed; mutation
 * categories are not in the mapping.
 *
 * No SDK calls. No new persistence. Tenant-scoped via the underlying
 * priority engine.
 */

import "server-only";

import { buildPriorityReport } from "./priorityEngine";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { PriorityCategory, PriorityItem } from "./priorityModel";
import type {
  ActionSafetyLevel,
  ActionType,
  ActionUrgency,
  NextActionItem,
  NextActionReport,
} from "./nextActionModel";

export interface BuildNextActionsInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildNextActions(input: BuildNextActionsInput): Promise<NextActionReport> {
  const priorityReport = await buildPriorityReport({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });

  const items: NextActionItem[] = [];

  for (const p of priorityReport.items) {
    const action = mapPriorityToAction(p);
    if (action) items.push(action);
  }

  // Add foundational actions when nothing else surfaces (helps the empty case
  // never read as "you're done"; there's always at least audit-ready work).
  if (items.length === 0) {
    items.push({
      id: "next:review_command_center",
      rank: 1,
      title: "Open Command Center",
      description: "Nothing urgent in the priority queue — review canonical state and confirm everything is operating normally.",
      actionType: "review_risk_queue",
      safetyLevel: "safe_review",
      urgency: "scheduled",
      reasonSummary: "Priority queue is clear.",
      expectedOutcome: "You'll see the unified Axiom OS state with no operator-action signals.",
      reversible: true,
      canRunNow: true,
      sourceSystem: "axiom_os",
      sourceMode: "live",
      route: { label: "Open Command Center", href: "/dashboard/command-center" },
      evidenceRefs: ["priority:queue_clear"],
      limitations: [],
    });
  }

  // Re-rank by canRunNow + urgency, preserving incoming order within bands.
  const ranked = items
    .sort((a, b) => {
      // canRunNow=true wins over blocked
      if (a.canRunNow !== b.canRunNow) return a.canRunNow ? -1 : 1;
      // urgency order
      const u = urgencyWeight(a.urgency) - urgencyWeight(b.urgency);
      if (u !== 0) return u;
      // safetyLevel preference: safe_readonly > safe_review > safe_preview > approval_required
      return safetyWeight(a.safetyLevel) - safetyWeight(b.safetyLevel);
    })
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const bySafetyLevel = ranked.reduce<Record<ActionSafetyLevel, number>>((acc, i) => {
    acc[i.safetyLevel] = (acc[i.safetyLevel] ?? 0) + 1;
    return acc;
  }, {
    safe_readonly: 0, safe_review: 0, safe_preview: 0,
    approval_required: 0, blocked_by_config: 0, blocked_by_policy: 0, disabled: 0,
  });

  return {
    generatedAt: priorityReport.generatedAt,
    tenantId: priorityReport.tenantId,
    items: ranked,
    summary: {
      total:             ranked.length,
      canRunNow:         ranked.filter((i) => i.canRunNow).length,
      approvalRequired:  ranked.filter((i) => i.safetyLevel === "approval_required").length,
      blockedByConfig:   ranked.filter((i) => i.safetyLevel === "blocked_by_config").length,
      blockedByPolicy:   ranked.filter((i) => i.safetyLevel === "blocked_by_policy").length,
      bySafetyLevel,
    },
    safetyContract: "no_mutation_actions_emitted",
    limitations: [
      "Next-Best-Action engine is a pure projection — every action route opens a review or read-only surface.",
      ...priorityReport.limitations,
    ],
    safeNextAction: { label: "Open Priorities", href: "/dashboard/priorities" },
  };
}

// ---------------------------------------------------------------------------
// Priority → Action mapping. Closed set. No mutation types in the mapping.
// ---------------------------------------------------------------------------

interface ActionShape {
  actionType: ActionType;
  safetyLevel: ActionSafetyLevel;
  expectedOutcome: string;
}

function mapPriorityToAction(p: PriorityItem): NextActionItem | null {
  const shape = SHAPE_BY_CATEGORY[p.category];
  if (!shape) return null;

  // Resolve safety level — escalate to blocked when the priority item
  // declares it's blocked. We never demote — operator visibility wins.
  let safety = shape.safetyLevel;
  if (p.blockedBy === "missing_config") safety = "blocked_by_config";
  if (p.blockedBy === "policy") safety = "blocked_by_policy";

  const canRunNow = safety === "safe_readonly" || safety === "safe_review" || safety === "safe_preview";

  return {
    id: `next:${p.id}`,
    rank: 0, // assigned after sort
    title: titleForCategory(p),
    description: p.reasonSummary,
    actionType: shape.actionType,
    safetyLevel: safety,
    urgency: p.urgency,
    reasonSummary: p.whyItMatters,
    expectedOutcome: shape.expectedOutcome,
    reversible: true,
    canRunNow,
    blockedReason: !canRunNow ? blockReasonText(safety) : undefined,
    sourceSystem: p.sourceSystem,
    sourceMode: p.sourceMode,
    linkedPriorityId: p.id,
    route: p.safeNextAction,
    evidenceRefs: p.evidenceRefs,
    limitations: p.limitations,
  };
}

const SHAPE_BY_CATEGORY: Partial<Record<PriorityCategory, ActionShape>> = {
  security_finding: {
    actionType: "review_finding",
    safetyLevel: "safe_review",
    expectedOutcome: "You'll see the canonical findings list with severity + evidence + safeNextAction per finding.",
  },
  release_blocker: {
    actionType: "review_finding",
    safetyLevel: "safe_review",
    expectedOutcome: "You'll see ReleaseOps blockers with the workflow / branch protection / deployment env context.",
  },
  integration_blocker: {
    actionType: "configure_credentials",
    safetyLevel: "blocked_by_config",
    expectedOutcome: "Following the setup docs will resolve missingRequirements and move the source to live read-only.",
  },
  policy_violation: {
    actionType: "review_policy_blocker",
    safetyLevel: "blocked_by_policy",
    expectedOutcome: "You'll see the violated policy rule + safeNextAction. No automated bypass exists.",
  },
  readiness_blocker: {
    actionType: "review_setup_wizard",
    safetyLevel: "safe_review",
    expectedOutcome: "You'll see the readiness blocker + the exact env var or config required to clear it.",
  },
  approval_pending: {
    actionType: "request_approval",
    safetyLevel: "approval_required",
    expectedOutcome: "Open the approval queue and decide each pending item; approving never auto-applies.",
  },
  desktop_blocker: {
    actionType: "review_on_desktop",
    safetyLevel: "safe_review",
    expectedOutcome: "You'll see desktop pairing status + the safe next pairing step. Local execution remains disabled.",
  },
  evidence_gap: {
    actionType: "export_evidence",
    safetyLevel: "safe_preview",
    expectedOutcome: "You'll see the current evidence library + an export-bundle option.",
  },
  operational_drift: {
    actionType: "create_simulation",
    safetyLevel: "safe_preview",
    expectedOutcome: "Simulating the candidate runs it against the digital twin only — never the real cloud.",
  },
  recurring: {
    actionType: "review_recurring_issue",
    safetyLevel: "safe_review",
    expectedOutcome: "You'll see the recurrence pattern + safeNextAction.",
  },
};

function titleForCategory(p: PriorityItem): string {
  switch (p.category) {
    case "security_finding":    return `Review ${p.severity} security finding${p.title.includes("findings") ? "s" : ""}`;
    case "release_blocker":     return `Review release blocker: ${p.title}`;
    case "integration_blocker": return `Resolve integration blocker: ${p.title}`;
    case "policy_violation":    return `Review policy decision: ${p.title}`;
    case "readiness_blocker":   return `Clear readiness blocker: ${p.title}`;
    case "approval_pending":    return `Decide on ${p.title}`;
    case "desktop_blocker":     return `Resolve desktop blocker: ${p.title}`;
    case "evidence_gap":        return `Inspect evidence library`;
    case "operational_drift":   return `Simulate next: ${p.title}`;
    case "recurring":           return `Review recurring issue: ${p.title}`;
    default:                    return p.title;
  }
}

function urgencyWeight(u: ActionUrgency): number {
  return u === "now" ? 0 : u === "this_week" ? 1 : u === "this_month" ? 2 : 3;
}

function safetyWeight(s: ActionSafetyLevel): number {
  // Lower weight wins (sorted ascending).
  switch (s) {
    case "safe_readonly":     return 0;
    case "safe_review":       return 1;
    case "safe_preview":      return 2;
    case "approval_required": return 3;
    case "blocked_by_config": return 4;
    case "blocked_by_policy": return 5;
    case "disabled":          return 6;
  }
}

function blockReasonText(s: ActionSafetyLevel): string {
  switch (s) {
    case "approval_required": return "Requires explicit approval before downstream effects.";
    case "blocked_by_config": return "Missing config — follow the safe action to resolve.";
    case "blocked_by_policy": return "Blocked by policy — review the violated rule.";
    case "disabled":          return "Disabled by safety contract.";
    default:                  return "";
  }
}
