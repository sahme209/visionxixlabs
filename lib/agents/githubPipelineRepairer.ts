/**
 * Pure GitHub pipeline repairer.
 *
 * Input: a failed GitHub Actions run summary — job + step + log
 * excerpt + previous successful run. Output: a typed proposal —
 * what's wrong, why, what to change, and the YAML / file patch
 * to apply. Approval-gated downstream.
 *
 * Closed unions on failure category + proposal kind so future
 * shapes break the build. Pure / deterministic.
 *
 * This kernel does NOT call the GitHub API. The approver later
 * opens a PR with the proposed change after an approval packet
 * is signed.
 */

export type FailureCategory =
  | "transient_network"     // timeout, ECONNRESET, registry blip
  | "dependency_install"    // npm / pip / cargo install failure
  | "compilation"           // tsc / rustc / go-build failure
  | "test_failure"          // assert / expect failed
  | "lint"                  // eslint / clippy / golangci-lint
  | "auth"                  // missing secret, expired token
  | "permission"            // 403 on push, missing GITHUB_TOKEN scope
  | "infra"                 // runner OOM, disk full
  | "config_drift"          // workflow yaml references missing file
  | "unknown";

export type ProposalKind =
  | "retry"
  | "pin_dependency"
  | "quarantine_test"
  | "fix_secret_scope"
  | "raise_runner_size"
  | "patch_workflow_yaml"
  | "open_investigation_ticket";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface FailedRunSummary {
  /** GitHub Actions run id. */
  runId: string;
  /** Repo (owner/name). */
  repo: string;
  /** Branch the run is on. */
  branch: string;
  /** Job name that failed. */
  jobName: string;
  /** Step name that failed. */
  stepName: string;
  /** Last ~1000 chars of the failed step's log. */
  logExcerpt: string;
  /** Recent failure rate on this branch over the last 30 days, [0, 1]. */
  flakeRate30d: number;
  /** Sha of the last successful run on the same workflow, if any. */
  lastGreenSha: string | null;
}

export interface RepairProposal {
  id: string;
  category: FailureCategory;
  proposalKind: ProposalKind;
  riskTier: RiskTier;
  /** Operator-readable headline. */
  title: string;
  /** Full rationale. */
  rationale: string;
  /** Repo-relative file path to patch, or null when the proposal is
   * retry / open-investigation. */
  filePath: string | null;
  /** Patch body (YAML / config) — caller renders this in the PR. */
  patch: string | null;
  /** Recommended approval gate. */
  recommendedGate: "auto_retry" | "single_approval" | "dual_approval";
  /** Confidence 0..1 — operator can sort by this. */
  confidence: number;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `repair-${counter}`;
}

/** Reset the in-process counter — tests only. */
export function __resetRepairCounter(): void {
  counter = 0;
}

const SIGNATURES: ReadonlyArray<{
  category: FailureCategory;
  pattern: RegExp;
  hint: string;
}> = [
  { category: "transient_network", pattern: /ECONNRESET|ETIMEDOUT|getaddrinfo (?:ENOTFOUND|EAI_AGAIN)|registry\.npmjs\.org.*(?:timeout|unreachable)/i, hint: "transient network blip" },
  { category: "dependency_install", pattern: /npm ERR!.*(?:404|ETARGET|EACCES)|pip install.*ERROR|cargo install.*error/i,                              hint: "dependency install failed" },
  { category: "compilation", pattern: /\bTS\d{4,}\b|cannot find module|undefined reference|rustc: error|go: error|build failed/i,                       hint: "compile-time failure" },
  { category: "test_failure", pattern: /AssertionError|expect\(.+\)\.to|FAIL\b|✗\b|Expected.*to (?:equal|be|contain)/i,                                  hint: "test assertion failed" },
  { category: "lint", pattern: /eslint|clippy|golangci-lint|@typescript-eslint/i,                                                                       hint: "lint failure" },
  { category: "auth", pattern: /401 (?:Unauthorized|Unauthorised)|invalid token|secret.*not found|GITHUB_TOKEN/i,                                       hint: "auth / secret missing" },
  { category: "permission", pattern: /403 Forbidden|Resource not accessible by integration|permission denied to push/i,                                 hint: "permission scope mismatch" },
  { category: "infra", pattern: /out of memory|no space left on device|runner.*OOM|killed by SIGKILL/i,                                                  hint: "runner ran out of resources" },
  { category: "config_drift", pattern: /workflow file.*missing|uses:.*not found|invalid workflow file/i,                                                hint: "workflow yaml references something missing" },
];

function classify(logExcerpt: string): FailureCategory {
  for (const s of SIGNATURES) {
    if (s.pattern.test(logExcerpt)) return s.category;
  }
  return "unknown";
}

function proposalFor(category: FailureCategory, summary: FailedRunSummary): RepairProposal {
  switch (category) {
    case "transient_network":
      return {
        id: nextId(),
        category,
        proposalKind: "retry",
        riskTier: "low",
        title: "Retry — transient network failure suspected",
        rationale: `Log signature matches transient network (DNS / registry timeout). Auto-retry once before opening an investigation. Flake rate on this branch over 30d: ${(summary.flakeRate30d * 100).toFixed(1)}%.`,
        filePath: null,
        patch: null,
        recommendedGate: summary.flakeRate30d > 0.05 ? "single_approval" : "auto_retry",
        confidence: 0.78,
      };

    case "dependency_install":
      return {
        id: nextId(),
        category,
        proposalKind: "pin_dependency",
        riskTier: "medium",
        title: "Pin dependency to last-known-good version",
        rationale: `Dependency install failure detected. Lock the package to a pinned version and re-test. If you have ${summary.lastGreenSha ? `last green sha ${summary.lastGreenSha}` : "no last green sha"}, diff package files to find the offender.`,
        filePath: "package.json",
        patch: "# Pin the failing dep to last-green version.\n# (Caller fills in the exact name + version.)",
        recommendedGate: "single_approval",
        confidence: 0.64,
      };

    case "compilation":
      return {
        id: nextId(),
        category,
        proposalKind: "patch_workflow_yaml",
        riskTier: "medium",
        title: "Compile error — open a triage proposal",
        rationale: "Compile-time failure; cannot be auto-patched without source-level context. Stage a triage proposal with the failing module + suggested fix.",
        filePath: null,
        patch: null,
        recommendedGate: "single_approval",
        confidence: 0.55,
      };

    case "test_failure":
      return {
        id: nextId(),
        category,
        proposalKind: "quarantine_test",
        riskTier: summary.flakeRate30d > 0.1 ? "low" : "medium",
        title: summary.flakeRate30d > 0.1 ? "Quarantine a known-flaky test" : "Investigate a real test failure",
        rationale: summary.flakeRate30d > 0.1
          ? `This test has flaked ${(summary.flakeRate30d * 100).toFixed(1)}% of runs over 30d. Quarantine + open a ticket to root-cause.`
          : "Assertion failed on a stable test — surface as a real defect, not a flake.",
        filePath: null,
        patch: null,
        recommendedGate: summary.flakeRate30d > 0.1 ? "single_approval" : "dual_approval",
        confidence: 0.66,
      };

    case "lint":
      return {
        id: nextId(),
        category,
        proposalKind: "patch_workflow_yaml",
        riskTier: "low",
        title: "Auto-fix lint",
        rationale: "Lint failure can typically be auto-fixed by the linter. Open a PR running the auto-fixer for the failed step.",
        filePath: null,
        patch: null,
        recommendedGate: "single_approval",
        confidence: 0.72,
      };

    case "auth":
      return {
        id: nextId(),
        category,
        proposalKind: "fix_secret_scope",
        riskTier: "high",
        title: "Secret missing or token scope insufficient",
        rationale: "Auth failure detected. Verify the secret exists in repo + env scope. Rotate if expired. Approval-gated because it touches credentials.",
        filePath: null,
        patch: null,
        recommendedGate: "dual_approval",
        confidence: 0.81,
      };

    case "permission":
      return {
        id: nextId(),
        category,
        proposalKind: "fix_secret_scope",
        riskTier: "high",
        title: "GITHUB_TOKEN permission scope insufficient",
        rationale: "403 Forbidden on a write action. The workflow's `permissions:` block likely doesn't grant the required scope (e.g. contents: write).",
        filePath: ".github/workflows/<workflow>.yml",
        patch: "permissions:\n  contents: write\n  pull-requests: write\n",
        recommendedGate: "single_approval",
        confidence: 0.7,
      };

    case "infra":
      return {
        id: nextId(),
        category,
        proposalKind: "raise_runner_size",
        riskTier: "medium",
        title: "Runner exhausted — raise size",
        rationale: "OOM or disk-full on the runner. Move to a larger runner (linux-large) or split the job to reduce per-step memory.",
        filePath: ".github/workflows/<workflow>.yml",
        patch: "runs-on: ubuntu-latest-large\n",
        recommendedGate: "single_approval",
        confidence: 0.68,
      };

    case "config_drift":
      return {
        id: nextId(),
        category,
        proposalKind: "patch_workflow_yaml",
        riskTier: "medium",
        title: "Workflow YAML references missing file or action",
        rationale: "Workflow file points at a missing path or action. Patch the YAML to reference the actual location.",
        filePath: ".github/workflows/<workflow>.yml",
        patch: null,
        recommendedGate: "single_approval",
        confidence: 0.6,
      };

    case "unknown":
      return {
        id: nextId(),
        category,
        proposalKind: "open_investigation_ticket",
        riskTier: "medium",
        title: "Unrecognised failure — open investigation",
        rationale: "Log signature didn't match any known pattern. Open a triage ticket with the log excerpt + last-green-sha for human review.",
        filePath: null,
        patch: null,
        recommendedGate: "single_approval",
        confidence: 0.35,
      };
  }
}

export function repairPipeline(summary: FailedRunSummary): RepairProposal {
  if (summary.flakeRate30d < 0 || summary.flakeRate30d > 1) {
    throw new Error("flakeRate30d must be between 0 and 1.");
  }
  const category = classify(summary.logExcerpt);
  return proposalFor(category, summary);
}
