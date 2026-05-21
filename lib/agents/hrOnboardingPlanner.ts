/**
 * Pure HR onboarding planner.
 *
 * Input: a new-hire descriptor — role family, employment type, start
 * date, work location, manager email. Output: a typed onboarding plan
 * — a sequence of dated tasks grouped by phase (pre-start / day-one /
 * week-one / month-one) plus a closed-union risk verdict.
 *
 * Pure / deterministic. No I/O. Each task references the IT / HR / sub-
 * tool the platform delegates the actual action to (e.g. "/dashboard/
 * it-support" for IAM access provisioning). Tasks become approval
 * packets downstream.
 */

export type RoleFamily =
  | "engineering"
  | "product"
  | "design"
  | "data_ai"
  | "ops_sre"
  | "security"
  | "sales"
  | "customer_success"
  | "finance"
  | "people";

export type EmploymentType = "fte" | "contractor" | "intern";

export type OnboardingPhase =
  | "pre_start"
  | "day_one"
  | "week_one"
  | "month_one";

export type TaskOwner =
  | "it_support"
  | "hr"
  | "manager"
  | "security"
  | "finance"
  | "buddy"
  | "employee";

export type RiskTier = "low" | "medium" | "high";

export interface NewHire {
  /** Stable hire id (e.g. emp-2026-0042). */
  id: string;
  fullName: string;
  workEmail: string;
  roleFamily: RoleFamily;
  employmentType: EmploymentType;
  /** ISO date the employee starts. */
  startDate: string;
  workLocation: "remote" | "hybrid" | "onsite";
  /** Manager's work email — used for approval routing. */
  managerEmail: string;
  /** True when the role requires elevated access (root/IAM/finance). */
  requiresElevatedAccess: boolean;
}

export interface OnboardingTask {
  id: string;
  phase: OnboardingPhase;
  /** Day offset from startDate. Negative = pre-start. */
  dayOffset: number;
  owner: TaskOwner;
  title: string;
  /** Operator-readable detail. */
  detail: string;
  /** Closed-union dependency on another platform surface. */
  delegateTo:
    | "/dashboard/it-support"
    | "/dashboard/hr"
    | "/dashboard/sub-tools/security"
    | "/dashboard/billing"
    | "/dashboard/connectors"
    | null;
  /** True when the task requires an approval packet to complete. */
  approvalRequired: boolean;
  /** Closed-union risk tier. */
  riskTier: RiskTier;
}

export interface OnboardingPlan {
  hire: NewHire;
  tasks: readonly OnboardingTask[];
  /** Worst risk among tasks. */
  overallRiskTier: RiskTier;
  /** Closed-union readiness verdict. */
  readiness: "ready" | "blocked" | "needs_review";
  /** Operator-readable rationale for the readiness state. */
  rationale: string;
}

let counter = 0;
function nextId(): string { counter += 1; return `obt-${counter}`; }
export function __resetOnboardingCounter(): void { counter = 0; }

const ROLE_TOOLS: Record<RoleFamily, readonly string[]> = {
  engineering:       ["GitHub", "Slack", "Linear", "VPN", "AWS dev account"],
  product:           ["Slack", "Linear", "Notion", "Figma view-only"],
  design:            ["Figma", "Slack", "Linear"],
  data_ai:           ["Slack", "BigQuery / Snowflake", "Notion", "Python sandbox"],
  ops_sre:           ["PagerDuty", "Datadog", "AWS prod (break-glass)", "VPN"],
  security:          ["Vanta", "Datadog", "AWS audit account", "VPN"],
  sales:             ["Slack", "CRM", "Email signature", "Calendar"],
  customer_success:  ["Slack", "CRM", "Helpdesk", "Knowledge base"],
  finance:           ["Slack", "Stripe (read-only)", "QuickBooks / Xero"],
  people:            ["Slack", "HRIS", "Calendar", "Notion"],
};

export function planOnboarding(hire: NewHire): OnboardingPlan {
  const tasks: OnboardingTask[] = [];

  // ── pre_start ────────────────────────────────────────────────
  tasks.push({
    id: nextId(),
    phase: "pre_start",
    dayOffset: -7,
    owner: "hr",
    title: "Send offer letter + I-9 / right-to-work packet",
    detail: `Send to ${hire.workEmail}. Confirm signature 5 days before ${hire.startDate}.`,
    delegateTo: "/dashboard/hr",
    approvalRequired: true,
    riskTier: "medium",
  });
  tasks.push({
    id: nextId(),
    phase: "pre_start",
    dayOffset: -3,
    owner: "it_support",
    title: hire.workLocation === "remote" ? "Ship laptop to home address" : "Stage laptop at desk",
    detail: hire.workLocation === "remote"
      ? "Ship M-series MacBook, USB-C dongle, external display. Confirm tracking 48h before start."
      : "Pre-stage laptop at the employee's seat. Confirm with facilities.",
    delegateTo: "/dashboard/it-support",
    approvalRequired: false,
    riskTier: "low",
  });

  // ── day_one ──────────────────────────────────────────────────
  tasks.push({
    id: nextId(),
    phase: "day_one",
    dayOffset: 0,
    owner: "it_support",
    title: "Provision SSO + email + base tooling",
    detail: `Create ${hire.workEmail} in SSO, group: ${hire.roleFamily}. Tooling: ${ROLE_TOOLS[hire.roleFamily].slice(0, 3).join(", ")}.`,
    delegateTo: "/dashboard/it-support",
    approvalRequired: false,
    riskTier: "low",
  });
  tasks.push({
    id: nextId(),
    phase: "day_one",
    dayOffset: 0,
    owner: "hr",
    title: "Welcome session + handbook + policy ack",
    detail: "30-min welcome + acknowledge code-of-conduct + security policy + acceptable-use policy.",
    delegateTo: "/dashboard/hr",
    approvalRequired: false,
    riskTier: "low",
  });
  tasks.push({
    id: nextId(),
    phase: "day_one",
    dayOffset: 0,
    owner: "manager",
    title: "Assign onboarding buddy + 30-day plan",
    detail: `Manager ${hire.managerEmail} assigns a buddy from the team and writes a 30-day success plan.`,
    delegateTo: null,
    approvalRequired: false,
    riskTier: "low",
  });

  // Elevated-access path
  if (hire.requiresElevatedAccess) {
    tasks.push({
      id: nextId(),
      phase: "day_one",
      dayOffset: 0,
      owner: "security",
      title: "Background check + security training (mandatory before elevated access)",
      detail: "Refuse IAM provisioning until both training and background check are signed.",
      delegateTo: "/dashboard/sub-tools/security",
      approvalRequired: true,
      riskTier: "high",
    });
  }

  // ── week_one ─────────────────────────────────────────────────
  tasks.push({
    id: nextId(),
    phase: "week_one",
    dayOffset: 3,
    owner: "it_support",
    title: "Provision role-specific tooling",
    detail: `Issue access to the rest of the role toolset: ${ROLE_TOOLS[hire.roleFamily].slice(3).join(", ") || "(none beyond base)"}.`,
    delegateTo: "/dashboard/it-support",
    approvalRequired: hire.requiresElevatedAccess,
    riskTier: hire.requiresElevatedAccess ? "high" : "medium",
  });

  if (hire.employmentType !== "intern") {
    tasks.push({
      id: nextId(),
      phase: "week_one",
      dayOffset: 5,
      owner: "finance",
      title: "Enroll in payroll + benefits",
      detail: "Add to payroll system, benefits portal, equity tracking. Confirm by Friday of week 1.",
      delegateTo: "/dashboard/billing",
      approvalRequired: true,
      riskTier: "medium",
    });
  }

  tasks.push({
    id: nextId(),
    phase: "week_one",
    dayOffset: 4,
    owner: "buddy",
    title: "Buddy check-in #1",
    detail: "30-min coffee chat + tour of relevant repos / documents.",
    delegateTo: null,
    approvalRequired: false,
    riskTier: "low",
  });

  // ── month_one ────────────────────────────────────────────────
  tasks.push({
    id: nextId(),
    phase: "month_one",
    dayOffset: 30,
    owner: "manager",
    title: "30-day review + adjust plan",
    detail: "Manager + employee review the 30-day plan, confirm fit, adjust scope for the next 60 days.",
    delegateTo: null,
    approvalRequired: false,
    riskTier: "low",
  });
  tasks.push({
    id: nextId(),
    phase: "month_one",
    dayOffset: 30,
    owner: "employee",
    title: "Submit onboarding survey",
    detail: "Anonymous feedback on the onboarding process. Used to improve the kernel's plan.",
    delegateTo: null,
    approvalRequired: false,
    riskTier: "low",
  });

  // Overall risk + readiness
  const overallRiskTier: RiskTier = tasks.reduce<RiskTier>((acc, t) => {
    const order: RiskTier[] = ["low", "medium", "high"];
    return order.indexOf(t.riskTier) > order.indexOf(acc) ? t.riskTier : acc;
  }, "low");

  let readiness: OnboardingPlan["readiness"];
  let rationale: string;
  if (!hire.fullName.trim() || !hire.workEmail.trim() || !hire.startDate.trim()) {
    readiness = "blocked";
    rationale = "Missing required hire fields (fullName / workEmail / startDate).";
  } else if (hire.requiresElevatedAccess && hire.employmentType === "intern") {
    readiness = "blocked";
    rationale = "Interns cannot be onboarded with elevated access — refuse and surface for HR review.";
  } else if (overallRiskTier === "high") {
    readiness = "needs_review";
    rationale = "Plan includes a high-risk task (elevated access / background check) — operator must approve before any task fires.";
  } else {
    readiness = "ready";
    rationale = "Plan is well-formed and routine — ready to dispatch under standard approvals.";
  }

  return { hire, tasks, overallRiskTier, readiness, rationale };
}
