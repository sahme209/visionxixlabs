/**
 * Desktop script catalog — typed registry of scripts the desktop
 * runtime can execute on macOS / Windows / Linux after an operator
 * approval handoff.
 *
 * Pure / no I/O. The desktop runtime consumes this catalog and
 * matches incoming handoff requests against it. A handoff that
 * references a script id not in this catalog is refused — that's
 * the safety contract: only registered scripts can run locally.
 *
 * Adding a script is an append here + a real implementation file in
 * the desktop binary repo. This catalog is the contract between the
 * platform and the desktop app.
 */

export type DesktopLanguage = "python" | "bash" | "node" | "powershell";

export type DesktopOs = "macos" | "windows" | "linux";

export type DesktopRiskTier = "low" | "medium" | "high" | "critical";

export type DesktopCapability =
  | "git"
  | "docker"
  | "kubectl"
  | "terraform"
  | "aws_cli"
  | "azure_cli"
  | "gcloud_cli"
  | "python_runtime"
  | "node_runtime"
  | "filesystem_read"
  | "filesystem_write"
  | "network"
  | "ssh"
  | "credentials_keychain";

export interface DesktopScript {
  /** Stable id — matches the entry in the desktop binary's runner. */
  id: string;
  /** Public display name. */
  name: string;
  category:
    | "repo_audit"
    | "env_diagnostic"
    | "log_parser"
    | "iac_validator"
    | "cloud_cli_check"
    | "ml_inference"
    | "report_generator";
  language: DesktopLanguage;
  supportsOs: ReadonlyArray<DesktopOs>;
  /** Capabilities the script needs — desktop refuses if any is unavailable. */
  requiresCapabilities: ReadonlyArray<DesktopCapability>;
  /**
   * Closed-union risk tier. Drives whether the desktop runtime needs
   * a local re-approval prompt on top of the platform approval. Anything
   * `high` or `critical` MUST prompt the device user even when the
   * platform approval is signed.
   */
  riskTier: DesktopRiskTier;
  /** Whether dry-run mode is supported (preview only, no side effects). */
  supportsDryRun: boolean;
  /** Operator-readable purpose. */
  purpose: string;
  /** Rollback note shown in the approval card when applicable. */
  rollbackNote: string | null;
  /** Max wall-clock seconds — desktop kills the script after this. */
  timeoutSeconds: number;
}

export const DESKTOP_SCRIPTS: readonly DesktopScript[] = [
  // ── Repo + dev environment ────────────────────────────────────
  {
    id: "repo_audit_v1",
    name: "Local Git repo audit",
    category: "repo_audit",
    language: "python",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["git", "filesystem_read", "python_runtime"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Inspect the local repo for stale branches, uncommitted work, and accidental secret patterns.",
    rollbackNote: null,
    timeoutSeconds: 120,
  },
  {
    id: "env_diagnostic_v1",
    name: "Developer environment diagnostic",
    category: "env_diagnostic",
    language: "bash",
    supportsOs: ["macos", "linux"],
    requiresCapabilities: ["filesystem_read"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Report installed versions of node, python, docker, kubectl, terraform, and cloud CLIs.",
    rollbackNote: null,
    timeoutSeconds: 60,
  },
  {
    id: "env_diagnostic_v1_win",
    name: "Developer environment diagnostic (Windows)",
    category: "env_diagnostic",
    language: "powershell",
    supportsOs: ["windows"],
    requiresCapabilities: ["filesystem_read"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Windows equivalent of env_diagnostic_v1 — uses powershell.",
    rollbackNote: null,
    timeoutSeconds: 60,
  },

  // ── Containers / IaC ──────────────────────────────────────────
  {
    id: "docker_health_v1",
    name: "Local Docker health check",
    category: "env_diagnostic",
    language: "bash",
    supportsOs: ["macos", "linux"],
    requiresCapabilities: ["docker"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Inspect daemon state, image counts, dangling resources, and per-container memory.",
    rollbackNote: null,
    timeoutSeconds: 60,
  },
  {
    id: "kubectl_context_check_v1",
    name: "Kubernetes context check",
    category: "env_diagnostic",
    language: "bash",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["kubectl"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Confirm current context, list nodes, surface unschedulable workloads.",
    rollbackNote: null,
    timeoutSeconds: 60,
  },
  {
    id: "terraform_validate_v1",
    name: "Terraform validate + plan",
    category: "iac_validator",
    language: "bash",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["terraform", "filesystem_read"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Run `terraform validate` and a `-out=plan.tfplan` capture. Never applies — plan stays local.",
    rollbackNote: null,
    timeoutSeconds: 300,
  },

  // ── Logs ──────────────────────────────────────────────────────
  {
    id: "log_parser_v1",
    name: "Local log parser",
    category: "log_parser",
    language: "python",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["filesystem_read", "python_runtime"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Stream a local log file and surface error patterns + frequency.",
    rollbackNote: null,
    timeoutSeconds: 180,
  },

  // ── Cloud CLI (read-only) ─────────────────────────────────────
  {
    id: "aws_cli_check_v1",
    name: "AWS CLI configuration check",
    category: "cloud_cli_check",
    language: "bash",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["aws_cli", "credentials_keychain"],
    riskTier: "medium",
    supportsDryRun: true,
    purpose: "Verify `aws sts get-caller-identity` works and configured profile matches the platform connector.",
    rollbackNote: "Read-only — no rollback needed.",
    timeoutSeconds: 60,
  },
  {
    id: "azure_cli_check_v1",
    name: "Azure CLI configuration check",
    category: "cloud_cli_check",
    language: "bash",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["azure_cli", "credentials_keychain"],
    riskTier: "medium",
    supportsDryRun: true,
    purpose: "Verify `az account show` succeeds and subscription matches.",
    rollbackNote: "Read-only — no rollback needed.",
    timeoutSeconds: 60,
  },
  {
    id: "gcloud_cli_check_v1",
    name: "Google Cloud CLI configuration check",
    category: "cloud_cli_check",
    language: "bash",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["gcloud_cli", "credentials_keychain"],
    riskTier: "medium",
    supportsDryRun: true,
    purpose: "Verify `gcloud auth list` + active project alignment.",
    rollbackNote: "Read-only — no rollback needed.",
    timeoutSeconds: 60,
  },

  // ── ML inference (local model gated) ──────────────────────────
  {
    id: "local_model_inference_v1",
    name: "Local AI model inference",
    category: "ml_inference",
    language: "python",
    supportsOs: ["macos", "linux"],
    requiresCapabilities: ["python_runtime"],
    riskTier: "high",
    supportsDryRun: false,
    purpose: "Run an inference against a locally installed model (must be approved on the Model Registry).",
    rollbackNote: "Inference is read-only; the gate is on the model itself.",
    timeoutSeconds: 600,
  },

  // ── Reporting ─────────────────────────────────────────────────
  {
    id: "report_generator_v1",
    name: "Developer-machine health report",
    category: "report_generator",
    language: "python",
    supportsOs: ["macos", "linux", "windows"],
    requiresCapabilities: ["filesystem_read", "python_runtime"],
    riskTier: "low",
    supportsDryRun: true,
    purpose: "Compose a markdown health report combining env_diagnostic + docker_health + kubectl_context.",
    rollbackNote: null,
    timeoutSeconds: 180,
  },
];

export function getDesktopScript(id: string): DesktopScript | undefined {
  return DESKTOP_SCRIPTS.find((s) => s.id === id);
}

export interface ResolveScriptResult {
  ok: boolean;
  reason?: "unknown_script" | "os_unsupported" | "missing_capability";
  /** When ok=false, the missing capability that blocked execution. */
  missing?: DesktopCapability;
}

/**
 * Pre-flight check the desktop runtime calls on a handoff: returns ok
 * only if the script exists, the OS is supported, and every required
 * capability is available locally.
 */
export function resolveScriptForRuntime(
  scriptId: string,
  os: DesktopOs,
  available: ReadonlyArray<DesktopCapability>,
): ResolveScriptResult {
  const script = getDesktopScript(scriptId);
  if (!script) return { ok: false, reason: "unknown_script" };
  if (!script.supportsOs.includes(os)) return { ok: false, reason: "os_unsupported" };
  const availSet = new Set(available);
  for (const cap of script.requiresCapabilities) {
    if (!availSet.has(cap)) return { ok: false, reason: "missing_capability", missing: cap };
  }
  return { ok: true };
}

export interface DesktopScriptCounts {
  total: number;
  byOs: Record<DesktopOs, number>;
  byLanguage: Record<DesktopLanguage, number>;
  byRiskTier: Record<DesktopRiskTier, number>;
}

export function summarizeDesktopScripts(): DesktopScriptCounts {
  const counts: DesktopScriptCounts = {
    total: DESKTOP_SCRIPTS.length,
    byOs: { macos: 0, windows: 0, linux: 0 },
    byLanguage: { python: 0, bash: 0, node: 0, powershell: 0 },
    byRiskTier: { low: 0, medium: 0, high: 0, critical: 0 },
  };
  for (const s of DESKTOP_SCRIPTS) {
    for (const os of s.supportsOs) counts.byOs[os] += 1;
    counts.byLanguage[s.language] += 1;
    counts.byRiskTier[s.riskTier] += 1;
  }
  return counts;
}
