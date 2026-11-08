/**
 * Governed deployment flow — single source of truth for the homepage 3D model
 * (docs/design/3d-visual-language-v4.md). Pure data, no I/O.
 *
 * Every system name and limit here must match what the codebase actually supports.
 * Sample values (reviewer, run numbers, tokens) are illustrative and the UI labels them so.
 */

export const FLOW_STATION_IDS = [
  "intake",
  "ai_analysis",
  "policy_scans",
  "approval_gate",
  "orchestrate",
  "execute",
  "validate",
  "audit_recovery",
] as const;
export type FlowStationId = (typeof FLOW_STATION_IDS)[number];

export type FlowZone = "source" | "control_plane" | "cloud";

export type FlowStation = Readonly<{
  id: FlowStationId;
  name: string;
  zone: FlowZone;
  summary: string;
  steps: readonly string[];
  dataIn: readonly string[];
  dataOut: readonly string[];
  systems: string;
  guarantee: string;
  onFailure: string;
  /** Illustrative read-outs for the holographic panel. */
  readout: readonly string[];
}>;

export const FLOW_STATIONS: readonly FlowStation[] = [
  {
    id: "intake", name: "Intake", zone: "source",
    summary: "Turns a release request into a pinned, attributable unit of work.",
    steps: [
      "Requester signs in to the Axiom workspace",
      "Selects repository, pull request and target environment",
      "Axiom reads the pull request through the GitHub App and pins the exact head commit",
      "The request is stored with requester, workspace and source identity",
    ],
    dataIn: ["repository", "pull request", "environment", "requester"],
    dataOut: ["request id", "pinned commit"],
    systems: "GitHub App (read access)",
    guarantee: "Nothing later can swap the commit or the requester.",
    onFailure: "Missing, foreign or mismatched source is refused before any AI call or credit hold.",
    readout: ["REQ  rq_7f3a", "REPO acme/web", "SHA  3f9a2c1", "ENV  production"],
  },
  {
    id: "ai_analysis", name: "AI analysis", zone: "control_plane",
    summary: "Gives reviewers a plain summary of the change and its risk.",
    steps: [
      "The workspace AI policy is read and the exact model is pinned",
      "A credit hold is reserved before the call",
      "Policy is re-checked inside the claim transaction",
      "One model call goes through the AI Gateway and tokens are metered",
      "The hold settles to actual usage, or is released on failure",
    ],
    dataIn: ["pinned diff", "workspace policy"],
    dataOut: ["risk summary", "token usage"],
    systems: "Vercel AI Gateway (for example Anthropic models)",
    guarantee: "No model call without current policy and a held credit; managed or virtual model routes are refused.",
    onFailure: "Policy disabled or credit short: no call, the hold is released and the request stays reviewable.",
    readout: ["MODEL claude-sonnet", "TOK  3,420", "HOLD $0.25", "POL  current"],
  },
  {
    id: "policy_scans", name: "Policy and scans", zone: "control_plane",
    summary: "Proves the change is ready using evidence, not optimism.",
    steps: [
      "Lint, test, build and security-scan results are collected from your CI",
      "Each result must belong to the pinned commit",
      "Freshness is checked against the readiness window",
      "Environment policy is evaluated; production raises risk and never lowers it",
    ],
    dataIn: ["CI results", "pinned commit"],
    dataOut: ["readiness verdict"],
    systems: "Your CI (for example GitHub Actions)",
    guarantee: "Axiom observes your CI results; it does not run your build.",
    onFailure: "Any missing, stale, foreign or failed result blocks the request here.",
    readout: ["LINT pass", "TEST pass", "BUILD pass", "SCAN fresh"],
  },
  {
    id: "approval_gate", name: "Approval gate", zone: "control_plane",
    summary: "A different person approves the exact plan, and nothing more.",
    steps: [
      "The proposal shows tool, arguments, risk, workspace and status",
      "The reviewer must be independent of the requester",
      "Approve and reject use separate authenticated endpoints",
      "An optional change ticket is linked and the team is notified",
    ],
    dataIn: ["proposal", "reviewer"],
    dataOut: ["decision", "approved scope"],
    systems: "Axiom review, with optional ServiceNow or Jira and Slack or Teams",
    guarantee: "The requester can never approve their own request; approval is not permission to execute.",
    onFailure: "Rejected or expired: the barrier stays closed and the request ends, fully recorded.",
    readout: ["REVIEWER r.patel", "SCOPE plan_91c", "DECISION approved", "TICKET CHG0042"],
  },
  {
    id: "orchestrate", name: "Orchestrate", zone: "cloud",
    summary: "Hands the approved plan to your own workflow, exactly once.",
    steps: [
      "The original requester triggers the separate execution step",
      "Current authority, plan digest and target are re-checked",
      "A one-use dispatch claim is consumed before sending",
      "The workflow dispatch is sent to your system",
    ],
    dataIn: ["approved plan"],
    dataOut: ["dispatch id"],
    systems: "GitHub Actions workflow dispatch; AWS ECS through your own configured workflow",
    guarantee: "One use only; no automatic retry after an unacknowledged send.",
    onFailure: "Authority changed or the plan drifted: refused before dispatch.",
    readout: ["DISPATCH wf_deploy", "CLAIM consumed", "RETRY none", "AUTH current"],
  },
  {
    id: "execute", name: "Execute", zone: "cloud",
    summary: "Your workflow deploys in your account, with your credentials.",
    steps: [
      "Your workflow builds or pulls the approved artifact",
      "It updates the target service, for example on AWS ECS",
      "Axiom waits for the result; it does not hold your cloud keys",
    ],
    dataIn: ["dispatch"],
    dataOut: ["run result"],
    systems: "Your cloud (for example AWS ECS)",
    guarantee: "Execution authority stays in your cloud. Terraform apply is not available; Terraform plans are review-only.",
    onFailure: "Lost or ambiguous response: the outcome becomes unknown and is never assumed successful.",
    readout: ["RUN  #4812", "SVC  web-api", "TASKS 6/6", "REGION us-east-1"],
  },
  {
    id: "validate", name: "Validate", zone: "cloud",
    summary: "Success needs independent evidence, not just an approval.",
    steps: [
      "The workflow run conclusion is read",
      "Service health is read from your systems",
      "Both are compared with the approved scope and target",
    ],
    dataIn: ["run result", "service health"],
    dataOut: ["outcome evidence"],
    systems: "Workflow results and service health from your systems",
    guarantee: "Approval or dispatch acceptance never counts as proof of success.",
    onFailure: "An unknown outcome must be reconciled before any new action on that target.",
    readout: ["RUN  success", "HEALTH 100%", "DRIFT none", "CHECK verified"],
  },
  {
    id: "audit_recovery", name: "Audit and recovery", zone: "control_plane",
    summary: "Every step is recorded, and recovery goes through the same gates.",
    steps: [
      "Proposed, approved, rejected, executed and failed states are appended",
      "Evidence, reviewer and dispatch identity are linked",
      "A supported rollback is offered as a new governed request",
    ],
    dataIn: ["all events"],
    dataOut: ["audit record", "rollback option"],
    systems: "Axiom audit record",
    guarantee: "Reads are recorded as well as writes; nothing is silently undone.",
    onFailure: "Rollback re-enters intake and needs its own approval.",
    readout: ["EVENTS 14", "LINKED evidence", "ROLLBACK available", "RETAIN on"],
  },
];

export const FLOW_SCENARIO_IDS = ["approved", "failed_scan", "rejected", "unknown_outcome", "rollback"] as const;
export type FlowScenarioId = (typeof FLOW_SCENARIO_IDS)[number];

export type FlowScenario = Readonly<{
  id: FlowScenarioId;
  label: string;
  caption: string;
  /** Index of the last station the request reaches. */
  stop: number;
  /** Station where the request is blocked (red). */
  blockedAt?: number;
  /** Station shown as unknown or recovering (amber). */
  warningAt?: number;
  tokens: number;
  settledCostUsd: number;
  approval: string;
  outcome: string;
}>;

export const FLOW_SCENARIOS: readonly FlowScenario[] = [
  { id: "approved", label: "Approved release", stop: 7, tokens: 3420, settledCostUsd: 0.18, approval: "Approved", outcome: "100% healthy",
    caption: "Approved release: evidence passes, an independent reviewer approves, your cloud deploys, and Axiom verifies and records it." },
  { id: "failed_scan", label: "Failed scan", stop: 2, blockedAt: 2, tokens: 3420, settledCostUsd: 0.18, approval: "Not requested", outcome: "Not started",
    caption: "Failed scan: the security result is stale for this commit, so the request stops before anyone is asked to approve." },
  { id: "rejected", label: "Rejected", stop: 3, blockedAt: 3, tokens: 3420, settledCostUsd: 0.18, approval: "Rejected", outcome: "Not started",
    caption: "Rejected: the reviewer declines, the barrier never opens and nothing is dispatched." },
  { id: "unknown_outcome", label: "Unknown outcome", stop: 5, warningAt: 5, tokens: 3420, settledCostUsd: 0.18, approval: "Approved", outcome: "Unknown, reconcile",
    caption: "Unknown outcome: the deploy response is lost, so Axiom marks it unknown and blocks new actions until it's reconciled." },
  { id: "rollback", label: "Rollback", stop: 7, warningAt: 6, tokens: 4100, settledCostUsd: 0.22, approval: "Approved (rollback)", outcome: "Rolled back",
    caption: "Rollback: health regressed, so a new governed request restores the previous version through the same gates." },
];

/** Credit held while the AI call is in flight (illustrative quote). */
export const FLOW_HOLD_USD = 0.25;

export type FlowStationState = "passed" | "current" | "pending" | "blocked" | "warning" | "unreached";

export function flowScenario(id: FlowScenarioId): FlowScenario {
  const found = FLOW_SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error("unknown_flow_scenario");
  return found;
}

/** State of one station when the request has reached `reached` in a scenario. */
export function flowStationState(scenario: FlowScenario, index: number, reached: number): FlowStationState {
  if (scenario.blockedAt === index && reached >= index) return "blocked";
  if (scenario.warningAt === index && reached >= index) return "warning";
  if (index > scenario.stop) return "unreached";
  if (index < reached) return "passed";
  if (index === reached) return "current";
  return "pending";
}

export type FlowGauges = Readonly<{ stage: string; tokens: number; aiCreditUsd: number; aiCreditState: "none" | "held" | "settled"; approval: string; outcome: string }>;

/** Gauge read-outs for a scenario at a reached station. The AI call happens at station 1:
 * its credit is held during the call and settled to actual usage right after, in every scenario. */
export function flowGauges(scenario: FlowScenario, reached: number): FlowGauges {
  const k = Math.max(0, Math.min(reached, scenario.stop, FLOW_STATIONS.length - 1));
  const aiCreditState = k < 1 ? "none" : k === 1 ? "held" : "settled";
  return {
    stage: FLOW_STATIONS[k].name,
    tokens: k >= 1 ? scenario.tokens : 0,
    aiCreditUsd: aiCreditState === "none" ? 0 : aiCreditState === "held" ? FLOW_HOLD_USD : scenario.settledCostUsd,
    aiCreditState,
    approval: k >= 3 ? scenario.approval : k >= 1 ? "Pending" : "Not requested",
    outcome: k >= 5 ? scenario.outcome : "Not started",
  };
}

export type FlowLogLevel = "ok" | "blocked" | "warning";
export type FlowLogEntry = Readonly<{ at: string; event: string; detail: string; level: FlowLogLevel }>;

const OK_EVENTS: readonly (readonly [string, string])[] = [
  ["intake.accepted", "rq_7f3a sha=3f9a2c1 env=production"],
  ["ai.completed", "tokens=3420 credit settled"],
  ["readiness.verified", "lint test build scan fresh"],
  ["approval.granted", "reviewer=r.patel scope=plan_91c"],
  ["dispatch.sent", "wf_deploy claim=consumed"],
  ["execution.observed", "run=#4812 tasks=6/6"],
  ["outcome.verified", "health=100%"],
  ["audit.sealed", "events=14"],
];

/** Illustrative audit entries emitted up to and including the reached station. */
export function flowAuditLog(scenario: FlowScenario, reached: number): FlowLogEntry[] {
  const out: FlowLogEntry[] = [];
  const last = Math.min(reached, scenario.stop);
  for (let i = 0; i <= last; i++) {
    const at = `15:00:${String(i * 7).padStart(2, "0")}`;
    if (scenario.blockedAt === i) {
      out.push(i === 2
        ? { at, event: "readiness.blocked", detail: "scan result stale for sha 3f9a2c1", level: "blocked" }
        : { at, event: "approval.rejected", detail: "reviewer=r.patel", level: "blocked" });
    } else if (scenario.warningAt === i) {
      out.push(i === 5
        ? { at, event: "execution.unknown", detail: "response lost; reconcile required", level: "warning" }
        : { at, event: "rollback.requested", detail: "health regressed; new governed request", level: "warning" });
    } else {
      const [event, detail] = OK_EVENTS[i];
      out.push({ at, event, detail, level: "ok" });
    }
  }
  return out;
}

/** External systems drawn as connected nodes, each tied to the station that uses it. */
export const FLOW_EXTERNAL_SYSTEMS: readonly Readonly<{ name: string; station: FlowStationId }>[] = [
  { name: "GitHub", station: "intake" },
  { name: "AI Gateway", station: "ai_analysis" },
  { name: "Your CI", station: "policy_scans" },
  { name: "ServiceNow / Jira", station: "approval_gate" },
  { name: "Slack / Teams", station: "approval_gate" },
  { name: "GitHub Actions", station: "orchestrate" },
  { name: "AWS ECS", station: "execute" },
];
