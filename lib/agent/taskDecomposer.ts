/**
 * AGI Task Decomposer.
 *
 * Breaks a high-level user goal into a sequence of safe, typed tasks.
 * Each task carries its safety classification, required permission,
 * required provider capability, approval requirement, evidence
 * requirement, source mode, and next action. No task ever auto-executes
 * a destructive action — that is enforced by the work sequencer +
 * execution readiness evaluator downstream.
 *
 * Coordinates with:
 *  - multiCloudTaskEngine.ts (intent classification + per-target tasks)
 *  - capabilityCoverageMap.ts (what is live / preview / planned)
 *  - selfServeSetupOrchestrator.ts (setup tracks)
 */

import { classifyIntent, buildTask, type NormalisedTask, type TaskTargetDomain } from "@/lib/agent/multiCloudTaskEngine";
import { COVERAGE_ROWS } from "@/lib/cloud/capabilityCoverageMap";
import { listSetupFlows } from "@/lib/onboarding/selfServeSetupOrchestrator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecomposedTaskKind =
  | "observe"
  | "connect_provider"
  | "validate_setup"
  | "scan"
  | "find_findings"
  | "reason"
  | "policy_check"
  | "request_approval"
  | "build_execution_plan"
  | "review_in_desktop"
  | "verify_outcome"
  | "audit_record"
  | "remember";

export type TaskSafety = "safe_automatic" | "operator_required" | "approval_required" | "blocked";

export interface DecomposedTask {
  id: string;
  ordinal: number;
  kind: DecomposedTaskKind;
  title: string;
  safety: TaskSafety;
  requiredPermission: string[];
  requiredCapability: { domain: TaskTargetDomain; capability: string }[];
  approvalRequired: boolean;
  evidenceRequired: string[];
  sourceMode: "live" | "preview" | "planned" | "blocked";
  nextAction?: { label: string; href?: string };
  /** Linked normalised task from the multi-cloud task engine. */
  normalisedTask?: NormalisedTask;
}

export interface DecomposeInput {
  /** Plain-English goal. */
  goal: string;
  /** Optional: which providers should be considered. */
  preferredTargets?: TaskTargetDomain[];
  /** Optional operator roles for permission gating. */
  operatorRoles?: string[];
}

export interface DecomposeOutcome {
  goal: string;
  tasks: DecomposedTask[];
  summary: {
    total: number;
    automatic: number;
    operatorRequired: number;
    approvalGated: number;
    blocked: number;
  };
  /** Operator-friendly headline. */
  headline: string;
}

// ---------------------------------------------------------------------------
// Goal pattern matchers
// ---------------------------------------------------------------------------

type GoalPattern = {
  match: (goal: string) => boolean;
  /** Build the task list for this goal. */
  build: (input: DecomposeInput) => Omit<DecomposedTask, "ordinal" | "id">[];
  headline: (input: DecomposeInput) => string;
};

const PATTERNS: GoalPattern[] = [
  // Secure my cloud
  {
    match: (g) => /(secure|harden).*cloud/i.test(g),
    headline: () => "Secure your cloud — scan, reason, plan fixes, approval-gated apply.",
    build: () => [
      newObserve(),
      newValidate("AWS / Azure / GCP connection"),
      newScan("security"),
      newFindings("cloud_security"),
      newReason("severity-ordered security narrative"),
      newPolicy(),
      newBuildPlan("Terraform / CLI remediation plan"),
      newApproval("Operator + approver"),
      newReviewDesktop(),
      newVerify("Re-run security check"),
      newAudit(),
      newRemember(),
    ],
  },

  // Reduce cloud spend
  {
    match: (g) => /(reduce.*spend|cut.*cost|optimise.*cost|savings)/i.test(g),
    headline: () => "Reduce cloud spend — identify idle/oversized, propose Terraform fix.",
    build: () => [
      newObserve(),
      newValidate("Provider connections"),
      newScan("cost"),
      newFindings("idle_or_oversized"),
      newReason("savings impact + risk score"),
      newPolicy(),
      newBuildPlan("Terraform plan with rollback"),
      newApproval("Operator"),
      newReviewDesktop(),
      newVerify("Confirm cost telemetry drop"),
      newAudit(),
      newRemember(),
    ],
  },

  // Prepare this release
  {
    match: (g) => /(prepare.*release|ship.*release|production-ready)/i.test(g),
    headline: () => "Prepare release — score readiness, resolve blockers, validate, audit.",
    build: () => [
      newObserve(),
      newValidate("GitHub connection"),
      newScan("releaseops"),
      newFindings("release_blockers"),
      newReason("ordered blocker sequence with rollback notes"),
      newPolicy(),
      newApproval("Two approvers for production"),
      newReviewDesktop(),
      newVerify("Re-score readiness after fix"),
      newAudit(),
      newRemember(),
    ],
  },

  // Fix public exposure
  {
    match: (g) => /(fix|resolve|close).*public.*(exposure|bucket|endpoint|port)/i.test(g),
    headline: () => "Close public exposure — locate, plan, approve, apply, verify.",
    build: () => [
      newObserve(),
      newScan("network_exposure"),
      newFindings("public_resources"),
      newReason("severity + blast radius"),
      newPolicy(),
      newBuildPlan("Tighten network ACL + bucket policy"),
      newApproval("Approver required"),
      newReviewDesktop(),
      newVerify("Confirm public flag is false"),
      newAudit(),
      newRemember(),
    ],
  },

  // Connect my infrastructure
  {
    match: (g) => /(connect|onboard|setup).*(infrastructure|cloud|provider|aws|azure|gcp|github)/i.test(g),
    headline: () => "Connect your infrastructure — guided self-serve setup.",
    build: (input) => {
      const flows = listSetupFlows();
      const tasks: Omit<DecomposedTask, "ordinal" | "id">[] = [newObserve()];
      for (const flow of flows) {
        if (input.preferredTargets && input.preferredTargets.length > 0) {
          const t = flow.track as unknown as TaskTargetDomain;
          if (!input.preferredTargets.includes(t)) continue;
        }
        tasks.push({
          kind: "connect_provider",
          title: flow.title,
          safety: flow.status === "live" ? "operator_required" : "blocked",
          requiredPermission: ["operator"],
          requiredCapability: [{ domain: (flow.track as unknown as TaskTargetDomain), capability: "connection" }],
          approvalRequired: false,
          evidenceRequired: [`Setup flow: ${flow.track}`],
          sourceMode: flow.status === "live" ? "live" : flow.status === "preview" ? "preview" : flow.status === "planned" ? "planned" : "preview",
          nextAction: { label: flow.steps[0].title, href: flow.steps[0].action?.href ?? "/operator/onboarding" },
        });
        tasks.push(newValidate(`${flow.title} validator`));
      }
      tasks.push(newAudit(), newRemember());
      return tasks;
    },
  },

  // Make my setup production-ready
  {
    match: (g) => /(production[- ]ready|prod ready|enterprise ready)/i.test(g),
    headline: () => "Production-ready — close validation gaps + sign desktop + wire audit.",
    build: () => [
      newObserve(),
      newScan("platform_validation"),
      newFindings("validation_failures"),
      newReason("ordered engineering milestones"),
      newPolicy(),
      newAudit(),
      newRemember(),
    ],
  },

  // Review everything before deployment
  {
    match: (g) => /(review.*everything|review before deploy|pre-deploy)/i.test(g),
    headline: () => "Pre-deploy review — execution readiness across plans + pipelines + desktop.",
    build: () => [
      newObserve(),
      newScan("execution_readiness"),
      newFindings("readiness_factors"),
      newReason("readiness decision per plan"),
      newPolicy(),
      newApproval("Approver"),
      newReviewDesktop(),
      newAudit(),
      newRemember(),
    ],
  },

  // Prepare Terraform fixes
  {
    match: (g) => /(prepare|generate).*terraform|terraform.*(fix|plan)/i.test(g),
    headline: () => "Prepare Terraform — plan candidate with rollback + verification.",
    build: () => [
      newObserve(),
      newFindings("eligible_for_fix"),
      newReason("plan + rollback narrative"),
      newPolicy(),
      newBuildPlan("Terraform module + variables + outputs"),
      newApproval("Approver"),
      newReviewDesktop(),
      newAudit(),
      newRemember(),
    ],
  },

  // Explain what is wrong
  {
    match: (g) => /(explain|why|what.s wrong|root cause)/i.test(g),
    headline: () => "Explain — narrative reasoning with evidence references.",
    build: () => [
      newObserve(),
      newReason("evidence-grounded narrative"),
      newAudit(),
    ],
  },

  // Set up desktop workstation
  {
    match: (g) => /(set up|setup|install).*desktop|desktop.*setup/i.test(g),
    headline: () => "Set up desktop — pair workstation, validate handoff, review inbox.",
    build: () => [
      newObserve(),
      newValidate("Desktop handoff signer"),
      newReviewDesktop(),
      newAudit(),
      newRemember(),
    ],
  },
];

// ---------------------------------------------------------------------------
// Task templates
// ---------------------------------------------------------------------------

function newObserve(): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "observe",
    title: "Observe environment",
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "state" }],
    approvalRequired: false,
    evidenceRequired: ["Command Center state"],
    sourceMode: "live",
    nextAction: { label: "Open Command Center", href: "/dashboard/command-center" },
  };
}
function newValidate(label: string): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "validate_setup",
    title: `Validate · ${label}`,
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "connection" }],
    approvalRequired: false,
    evidenceRequired: ["Validation probe"],
    sourceMode: "live",
    nextAction: { label: "Run validation", href: "/api/validation/run" },
  };
}
function newScan(kind: string): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "scan",
    title: `Scan · ${kind}`,
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "all_clouds", capability: "inventory" }],
    approvalRequired: false,
    evidenceRequired: ["Snapshot", "Findings"],
    sourceMode: "preview",
    nextAction: { label: "Run security scan", href: "/api/security-scan" },
  };
}
function newFindings(kind: string): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "find_findings",
    title: `Surface findings · ${kind}`,
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "security_checks" }],
    approvalRequired: false,
    evidenceRequired: ["Finding ids"],
    sourceMode: "preview",
  };
}
function newReason(narrative: string): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "reason",
    title: `Reason · ${narrative}`,
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "reasoning_layer" }],
    approvalRequired: false,
    evidenceRequired: ["Reasoning trace"],
    sourceMode: "live",
  };
}
function newPolicy(): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "policy_check",
    title: "Policy check",
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "policy_engine" }],
    approvalRequired: false,
    evidenceRequired: ["Policy verdict"],
    sourceMode: "live",
  };
}
function newBuildPlan(detail: string): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "build_execution_plan",
    title: `Build execution plan · ${detail}`,
    safety: "operator_required",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "execution_plans" }],
    approvalRequired: true,
    evidenceRequired: ["Plan candidate", "Rollback"],
    sourceMode: "preview",
    nextAction: { label: "Open execution plans", href: "/dashboard/execution" },
  };
}
function newApproval(detail: string): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "request_approval",
    title: `Approval · ${detail}`,
    safety: "approval_required",
    requiredPermission: ["approver"],
    requiredCapability: [{ domain: "platform", capability: "approvals" }],
    approvalRequired: true,
    evidenceRequired: ["Plan candidate"],
    sourceMode: "live",
  };
}
function newReviewDesktop(): Omit<DecomposedTask, "ordinal" | "id"> {
  const desktopRow = COVERAGE_ROWS.find((r) => r.id === "desktop.handoff_inbox");
  return {
    kind: "review_in_desktop",
    title: "Review in desktop",
    safety: desktopRow?.status === "live" ? "operator_required" : "blocked",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "desktop", capability: "handoff" }],
    approvalRequired: false,
    evidenceRequired: ["Signed handoff payload"],
    sourceMode: desktopRow?.status === "live" ? "live" : "preview",
    nextAction: { label: "Open desktop inbox", href: "/desktop/inbox" },
  };
}
function newVerify(detail: string): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "verify_outcome",
    title: `Verify · ${detail}`,
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "verification" }],
    approvalRequired: false,
    evidenceRequired: ["Verification result"],
    sourceMode: "preview",
  };
}
function newAudit(): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "audit_record",
    title: "Audit · write trace + event",
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "audit" }],
    approvalRequired: false,
    evidenceRequired: ["Audit event id"],
    sourceMode: "live",
  };
}
function newRemember(): Omit<DecomposedTask, "ordinal" | "id"> {
  return {
    kind: "remember",
    title: "Memory · capture outcome pattern",
    safety: "safe_automatic",
    requiredPermission: ["operator"],
    requiredCapability: [{ domain: "platform", capability: "memory" }],
    approvalRequired: false,
    evidenceRequired: ["Memory record id"],
    sourceMode: "live",
  };
}

// ---------------------------------------------------------------------------
// Decomposer
// ---------------------------------------------------------------------------

function fallbackBuild(input: DecomposeInput): Omit<DecomposedTask, "ordinal" | "id">[] {
  // Fall back to the multi-cloud task engine + observation / audit wrappers.
  const _normalised = buildTask({ intent: input.goal, operatorRoles: input.operatorRoles });
  return [
    newObserve(),
    {
      kind: "reason",
      title: `Reason · ${_normalised.summary}`,
      safety: _normalised.availability === "live" ? "safe_automatic" : "operator_required",
      requiredPermission: _normalised.requiredRoles,
      requiredCapability: _normalised.requiredCapabilities.map((c) => ({ domain: c.domain, capability: c.capability })),
      approvalRequired: false,
      evidenceRequired: ["Reasoning trace"],
      sourceMode: _normalised.source === "live" ? "live" : _normalised.source === "preview" ? "preview" : "blocked",
      nextAction: _normalised.safeNextAction,
      normalisedTask: _normalised,
    },
    newAudit(),
  ];
}

function fallbackHeadline(input: DecomposeInput): string {
  const c = classifyIntent(input.goal);
  return `Decomposed against intent category "${c.category}" with confidence ${(c.confidence * 100).toFixed(0)}%.`;
}

export function decomposeGoal(input: DecomposeInput): DecomposeOutcome {
  const pattern = PATTERNS.find((p) => p.match(input.goal));
  const raw = pattern ? pattern.build(input) : fallbackBuild(input);
  const headline = pattern ? pattern.headline(input) : fallbackHeadline(input);

  const tasks: DecomposedTask[] = raw.map((t, idx) => ({
    ...t,
    id: `task.${idx + 1}.${t.kind}`,
    ordinal: idx + 1,
  }));

  const summary = {
    total: tasks.length,
    automatic:        tasks.filter((t) => t.safety === "safe_automatic").length,
    operatorRequired: tasks.filter((t) => t.safety === "operator_required").length,
    approvalGated:    tasks.filter((t) => t.safety === "approval_required").length,
    blocked:          tasks.filter((t) => t.safety === "blocked").length,
  };

  return { goal: input.goal, tasks, summary, headline };
}

export function listCanonicalGoals(): string[] {
  return [
    "Secure my cloud",
    "Reduce cloud spend",
    "Prepare this release",
    "Fix public exposure",
    "Connect my infrastructure",
    "Make my setup production-ready",
    "Review everything before deployment",
    "Prepare Terraform fixes",
    "Explain what is wrong",
    "Set up desktop workstation",
  ];
}
