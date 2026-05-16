/**
 * Internal security / vulnerability posture scanner.
 *
 * Runs typed checks across four scopes: cloud, app/platform, supply chain,
 * desktop. Every check produces a typed `SecurityCheckResult` with stable
 * id + severity + category + status + evidence + remediation. The Trust
 * Center, Security Center, and `/dashboard/security-scanner` page all
 * read from this engine.
 *
 * Honest by design: checks return `unknown` or `preview` when source
 * state isn't available, never fabricate a pass.
 */

import type { CloudProvider } from "@/lib/domain/provider";

export type SecurityCheckSeverity = "info" | "low" | "medium" | "high" | "critical";
export type SecurityCheckCategory =
  | "cloud_misconfig"
  | "iam_overreach"
  | "network_exposure"
  | "encryption_at_rest"
  | "backup_resilience"
  | "single_region"
  | "supply_chain"
  | "app_boundary"
  | "secret_handling"
  | "audit_gap"
  | "desktop_distribution"
  | "desktop_execution"
  | "release_governance"
  | "pipeline_health";
export type SecurityCheckStatus = "pass" | "fail" | "warn" | "unknown" | "preview";
export type SecurityCheckScope = "cloud" | "app" | "supply_chain" | "desktop" | "github";

export interface SecurityCheckResult {
  id: string;
  title: string;
  description: string;
  severity: SecurityCheckSeverity;
  category: SecurityCheckCategory;
  scope: SecurityCheckScope;
  /** Cloud provider this check is about — set only for cloud-scope checks. */
  provider?: CloudProvider;
  status: SecurityCheckStatus;
  evidence: string[];
  remediation?: string;
  affectedResources?: string[];
  /** Source — drives the honest "Preview" badge. */
  source: "live" | "preview";
}

// ---------------------------------------------------------------------------
// Scanner inputs
// ---------------------------------------------------------------------------

export interface SecurityScannerInputs {
  /** Preview-mode snapshots produced by the AWS/Azure/GCP preview scanners. */
  awsPreview?: { resources: { id: string; kind: string }[]; findings: { ruleCode: string; risk: SecurityCheckSeverity; resourceRef: string }[] };
  azurePreview?: { resources: { id: string; kind: string }[]; findings: { ruleCode: string; risk: SecurityCheckSeverity; resourceRef: string }[] };
  gcpPreview?: { resources: { id: string; kind: string }[]; findings: { ruleCode: string; risk: SecurityCheckSeverity; resourceRef: string }[] };
  /** App-level signals. Booleans the platform can directly attest. */
  app?: {
    redactionActive: boolean;
    auditStoreConfigured: boolean;
    copilotContextSafe: boolean;
    tenantScopeEnforcedServerSide: boolean;
    rbacWiredOnRoutes: boolean;
    desktopApplyBlockedByDefault: boolean;
  };
  /** Supply-chain signals. */
  supplyChain?: {
    lockfileCommitted: boolean;
    dependencyScanRun: boolean;
    secretScanningActive: boolean;
    buildSigningWired: boolean;
  };
  /** Desktop distribution state. */
  desktop?: {
    macosSigned: boolean;
    macosNotarized: boolean;
    windowsSigned: boolean;
    linuxSigned: boolean;
    handoffSignerConfigured: boolean;
    localApplyBlockedByDefault: boolean;
  };
  /** GitHub / ReleaseOps state — drives release-governance + pipeline-health checks. */
  github?: {
    /** Source mode the caller observed when assembling this input. */
    sourceMode: "live" | "partial" | "preview" | "disabled";
    /** Repositories the caller resolved. */
    repos: { id: string; name: string; defaultBranch: string; protected: boolean }[];
    /** Workflows resolved. */
    workflows: { id: string; repoId: string; name: string; lastRunStatus?: "success" | "failure" | "cancelled" | "in_progress" }[];
    /** Branch protection rows resolved. */
    protections: { repoId: string; branch: string; requiredReviewers: number; requireSignedCommits: boolean; requireStatusChecks: string[]; enforceAdmins: boolean }[];
    /** Whether GitHub credentials are present at all. */
    credentialsConfigured: boolean;
    /** Webhook secret presence (for future webhook handler). */
    webhookSecretConfigured?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface SecurityScanOutcome {
  generatedAt: string;
  results: SecurityCheckResult[];
  summary: SecurityScanSummary;
}

export interface SecurityScanSummary {
  total: number;
  pass: number;
  fail: number;
  warn: number;
  unknown: number;
  preview: number;
  /** 0..1 score weighting pass full + warn half + unknown zero. */
  score: number;
  /** Highest-severity unresolved check across all scopes. */
  topRisk?: SecurityCheckResult;
}

export async function runSecurityScan(input: SecurityScannerInputs): Promise<SecurityScanOutcome> {
  const results: SecurityCheckResult[] = [];

  // ---------- Cloud (preview-source) checks ----------
  if (input.awsPreview) results.push(...cloudChecksFromPreview("aws", input.awsPreview));
  if (input.azurePreview) results.push(...cloudChecksFromPreview("azure", input.azurePreview));
  if (input.gcpPreview) results.push(...cloudChecksFromPreview("gcp", input.gcpPreview));

  // ---------- App / platform checks ----------
  if (input.app) {
    results.push(boolCheck({
      id: "app.redaction",
      title: "Canonical redaction is wired",
      description: "Every log, event, and AI prompt passes through the redactor.",
      severity: "high",
      category: "secret_handling",
      scope: "app",
      ok: input.app.redactionActive,
      remediationIfFail: "Install the canonical redactor pipeline (lib/security/redaction.ts).",
    }));
    results.push(boolCheck({
      id: "app.audit_store",
      title: "Secure audit store configured",
      description: "Sensitive actions are persisted to a durable audit store.",
      severity: "high",
      category: "audit_gap",
      scope: "app",
      ok: input.app.auditStoreConfigured,
      remediationIfFail: "Wire the Prisma-backed SecureAuditStore at boot.",
    }));
    results.push(boolCheck({
      id: "app.copilot_safe",
      title: "Copilot context safety active",
      description: "buildSafeContext() + inbound/outbound guardrails are in place.",
      severity: "high",
      category: "secret_handling",
      scope: "app",
      ok: input.app.copilotContextSafe,
      remediationIfFail: "Install the safe-context pipeline before any LLM call.",
    }));
    results.push(boolCheck({
      id: "app.tenant_scope_server",
      title: "Tenant scope enforced server-side",
      description: "Every customer-data query is gated by an organizationId resolved server-side.",
      severity: "critical",
      category: "app_boundary",
      scope: "app",
      ok: input.app.tenantScopeEnforcedServerSide,
      remediationIfFail: "Extend the NextAuth session shape to carry organizationId + roles, then enforce in apiGuard.",
    }));
    results.push(boolCheck({
      id: "app.rbac_on_routes",
      title: "RBAC enforced on sensitive routes",
      description: "Mutating routes call evaluatePermission() before any side effect.",
      severity: "high",
      category: "app_boundary",
      scope: "app",
      ok: input.app.rbacWiredOnRoutes,
      remediationIfFail: "Migrate sensitive API routes onto apiGuard({ permission, ... }).",
    }));
    results.push(boolCheck({
      id: "app.desktop_apply_blocked",
      title: "Desktop apply blocked by default",
      description: "Local Terraform apply requires approval + policy + rollback + audit.",
      severity: "critical",
      category: "desktop_execution",
      scope: "app",
      ok: input.app.desktopApplyBlockedByDefault,
      remediationIfFail: "Restore the decideLocalExecution() guard — must refuse apply absent gates.",
    }));
  } else {
    results.push(unknownCheck({
      id: "app.signals_missing",
      title: "App security signals unavailable",
      description: "Caller did not provide app-level signals to the scanner.",
      severity: "info",
      category: "audit_gap",
      scope: "app",
    }));
  }

  // ---------- Supply chain checks ----------
  if (input.supplyChain) {
    results.push(boolCheck({
      id: "sc.lockfile",
      title: "Lockfile committed",
      description: "package-lock.json is present and verified by CI.",
      severity: "medium",
      category: "supply_chain",
      scope: "supply_chain",
      ok: input.supplyChain.lockfileCommitted,
      remediationIfFail: "Commit package-lock.json and require it in CI.",
    }));
    results.push(boolCheck({
      id: "sc.dep_scan",
      title: "Dependency vulnerability scanning active",
      description: "Automated scans run against the lockfile on every push.",
      severity: "medium",
      category: "supply_chain",
      scope: "supply_chain",
      ok: input.supplyChain.dependencyScanRun,
      remediationIfFail: "Wire Snyk / GitHub Dependabot / npm audit into CI.",
    }));
    results.push(boolCheck({
      id: "sc.secret_scan",
      title: "Secret scanning active",
      description: "Pre-commit + CI scans block accidental secret commits.",
      severity: "high",
      category: "supply_chain",
      scope: "supply_chain",
      ok: input.supplyChain.secretScanningActive,
      remediationIfFail: "Enable GitHub secret scanning or run trufflehog in CI.",
    }));
    results.push(boolCheck({
      id: "sc.build_signing",
      title: "Build artefact signing",
      description: "Production artefacts are signed before distribution.",
      severity: "medium",
      category: "supply_chain",
      scope: "supply_chain",
      ok: input.supplyChain.buildSigningWired,
      remediationIfFail: "Add signing to the desktop build pipeline (codesign + EV).",
    }));
  }

  // ---------- GitHub / ReleaseOps checks ----------
  if (input.github) {
    results.push(...githubChecksFromState(input.github));
  }

  // ---------- Desktop checks ----------
  if (input.desktop) {
    results.push(boolCheck({
      id: "desk.handoff_signer",
      title: "Desktop handoff signer configured",
      description: "DESKTOP_HANDOFF_SIGNING_KEY ≥ 32 chars present.",
      severity: "high",
      category: "desktop_execution",
      scope: "desktop",
      ok: input.desktop.handoffSignerConfigured,
      remediationIfFail: "Set DESKTOP_HANDOFF_SIGNING_KEY in the host env (or rely on NEXTAUTH_SECRET fallback).",
    }));
    results.push(boolCheck({
      id: "desk.local_apply_blocked",
      title: "Local apply blocked by default",
      description: "Desktop runtime refuses apply unless approval + policy + rollback + audit align.",
      severity: "critical",
      category: "desktop_execution",
      scope: "desktop",
      ok: input.desktop.localApplyBlockedByDefault,
      remediationIfFail: "Restore decideLocalExecution() guard in the desktop runtime.",
    }));
    results.push(boolCheck({
      id: "desk.macos_signed",
      title: "macOS binary signed",
      description: "Apple Developer ID signing complete.",
      severity: "medium",
      category: "desktop_distribution",
      scope: "desktop",
      ok: input.desktop.macosSigned,
      remediationIfFail: "Sign with Apple Developer ID before public distribution.",
    }));
    results.push(boolCheck({
      id: "desk.macos_notarized",
      title: "macOS binary notarized",
      description: "Apple notarytool completed.",
      severity: "medium",
      category: "desktop_distribution",
      scope: "desktop",
      ok: input.desktop.macosNotarized,
      remediationIfFail: "Run notarytool after signing.",
    }));
    results.push(boolCheck({
      id: "desk.windows_signed",
      title: "Windows binary signed (EV)",
      description: "Windows EV code signing complete.",
      severity: "medium",
      category: "desktop_distribution",
      scope: "desktop",
      ok: input.desktop.windowsSigned,
      remediationIfFail: "Sign Windows MSI/EXE with EV certificate.",
    }));
    results.push(boolCheck({
      id: "desk.linux_signed",
      title: "Linux package signed",
      description: "AppImage / .deb / .rpm signed.",
      severity: "low",
      category: "desktop_distribution",
      scope: "desktop",
      ok: input.desktop.linuxSigned,
      remediationIfFail: "GPG-sign the AppImage + repo-sign .deb / .rpm.",
    }));
  }

  // Summarise
  const summary = summarize(results);
  return { generatedAt: new Date().toISOString(), results, summary };
}

// ---------------------------------------------------------------------------
// Per-provider preview-source cloud check derivation
// ---------------------------------------------------------------------------

function cloudChecksFromPreview(
  provider: CloudProvider,
  preview: NonNullable<SecurityScannerInputs["awsPreview"]>,
): SecurityCheckResult[] {
  const out: SecurityCheckResult[] = [];
  for (const finding of preview.findings) {
    const cat = ruleCodeCategory(finding.ruleCode);
    out.push({
      id: `cloud.${provider}.${finding.ruleCode}.${finding.resourceRef}`,
      title: humaniseRule(finding.ruleCode),
      description: `Preview-state finding from ${provider} preview scanner.`,
      severity: finding.risk,
      category: cat,
      scope: "cloud",
      provider,
      status: "preview",
      evidence: [`${finding.ruleCode} on ${finding.resourceRef}`],
      remediation: remediationForRule(finding.ruleCode),
      affectedResources: [finding.resourceRef],
      source: "preview",
    });
  }
  return out;
}

function ruleCodeCategory(rule: string): SecurityCheckCategory {
  if (rule.includes("public") || rule.includes("ssh_any")) return "network_exposure";
  if (rule.includes("policy_wildcard") || rule.includes("iam")) return "iam_overreach";
  if (rule.includes("no_backup")) return "backup_resilience";
  if (rule.includes("idle") || rule.includes("engine_outdated")) return "cloud_misconfig";
  if (rule.includes("encryption")) return "encryption_at_rest";
  return "cloud_misconfig";
}

function humaniseRule(rule: string): string {
  return rule.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function remediationForRule(rule: string): string {
  if (rule.includes("public")) return "Block public access at the bucket / firewall level.";
  if (rule.includes("policy_wildcard")) return "Replace wildcard IAM action with explicit verbs.";
  if (rule.includes("no_backup")) return "Enable automated backups + verify restore.";
  if (rule.includes("idle")) return "Rightsize or terminate the underutilised resource.";
  if (rule.includes("engine_outdated")) return "Apply the recommended minor / patch version.";
  return "Review the resource configuration.";
}

// ---------------------------------------------------------------------------
// Boolean / unknown check helpers
// ---------------------------------------------------------------------------

function boolCheck(opts: {
  id: string;
  title: string;
  description: string;
  severity: SecurityCheckSeverity;
  category: SecurityCheckCategory;
  scope: SecurityCheckScope;
  ok: boolean;
  remediationIfFail?: string;
}): SecurityCheckResult {
  return {
    id: opts.id,
    title: opts.title,
    description: opts.description,
    severity: opts.severity,
    category: opts.category,
    scope: opts.scope,
    status: opts.ok ? "pass" : "fail",
    evidence: [opts.ok ? "platform attests true" : "platform attests false"],
    remediation: opts.ok ? undefined : opts.remediationIfFail,
    source: "live",
  };
}

// ---------------------------------------------------------------------------
// GitHub / ReleaseOps check derivation
// ---------------------------------------------------------------------------

function githubChecksFromState(state: NonNullable<SecurityScannerInputs["github"]>): SecurityCheckResult[] {
  const out: SecurityCheckResult[] = [];
  const isLive = state.sourceMode === "live" || state.sourceMode === "partial";
  const sourceTag: SecurityCheckResult["source"] = isLive ? "live" : "preview";

  // 0) Honest credential check — fails when ReleaseOps is enabled but no
  //    credentials are configured (= we cannot actually see anything).
  if (state.sourceMode !== "disabled") {
    out.push({
      id: "gh.credentials",
      title: "GitHub credentials configured",
      description: "ReleaseOps surfaces real data only when GITHUB_PAT (or GITHUB_APP_ID + GITHUB_PRIVATE_KEY) is set.",
      severity: "high",
      category: "release_governance",
      scope: "github",
      status: state.credentialsConfigured ? "pass" : "fail",
      evidence: [`source=${state.sourceMode}`, `credentials=${state.credentialsConfigured}`],
      remediation: state.credentialsConfigured
        ? undefined
        : "Set GITHUB_PAT in the server env and GITHUB_SYNC_MODE=live, or install the GitHub App.",
      source: sourceTag,
    });
  }

  // 1) Branch protection per repo
  for (const repo of state.repos) {
    const bp = state.protections.find((p) => p.repoId === repo.id && p.branch === repo.defaultBranch);
    const hasBp = Boolean(bp && (bp.requiredReviewers > 0 || bp.requireStatusChecks.length > 0));
    out.push({
      id: `gh.branch_protection.${repo.id}`,
      title: `Branch protection on ${repo.name}:${repo.defaultBranch}`,
      description: "Default branch should require reviewers and status checks before merge.",
      severity: hasBp ? "low" : "high",
      category: "release_governance",
      scope: "github",
      status: hasBp ? "pass" : "fail",
      evidence: bp
        ? [`requiredReviewers=${bp.requiredReviewers}`, `statusChecks=${bp.requireStatusChecks.length}`, `enforceAdmins=${bp.enforceAdmins}`]
        : ["no branch protection record found"],
      remediation: hasBp
        ? undefined
        : `Enable branch protection on ${repo.name}:${repo.defaultBranch}: ≥1 required reviewer + required status checks.`,
      affectedResources: [`${repo.name}/${repo.defaultBranch}`],
      source: sourceTag,
    });

    // 1b) Required status checks specifically
    if (bp && bp.requireStatusChecks.length === 0) {
      out.push({
        id: `gh.required_checks.${repo.id}`,
        title: `Required status checks missing on ${repo.name}`,
        description: "A protected branch with no required status checks lets unverified code merge.",
        severity: "medium",
        category: "release_governance",
        scope: "github",
        status: "fail",
        evidence: ["required_status_checks=[]"],
        remediation: `Add required status checks (e.g. CI, tests) on ${repo.name}:${repo.defaultBranch}.`,
        affectedResources: [`${repo.name}/${repo.defaultBranch}`],
        source: sourceTag,
      });
    }

    // 1c) Signed commits — informational
    if (bp && !bp.requireSignedCommits) {
      out.push({
        id: `gh.signed_commits.${repo.id}`,
        title: `Signed commits not required on ${repo.name}`,
        description: "Signed commits prevent unattributed pushes from bypassing approval policy.",
        severity: "low",
        category: "release_governance",
        scope: "github",
        status: "warn",
        evidence: ["require_signed_commits=false"],
        remediation: `Enable required signed commits on ${repo.name}:${repo.defaultBranch}.`,
        affectedResources: [`${repo.name}/${repo.defaultBranch}`],
        source: sourceTag,
      });
    }
  }

  // 2) Failing workflows
  const failingWorkflows = state.workflows.filter((w) => w.lastRunStatus === "failure");
  if (failingWorkflows.length > 0) {
    out.push({
      id: "gh.failing_workflows",
      title: `${failingWorkflows.length} workflow(s) currently failing`,
      description: "Failing CI workflows block safe deploys and indicate broken release pipelines.",
      severity: failingWorkflows.length >= 3 ? "high" : "medium",
      category: "pipeline_health",
      scope: "github",
      status: "fail",
      evidence: failingWorkflows.slice(0, 5).map((w) => `${w.repoId}/${w.name}`),
      remediation: "Open the failing workflow runs and fix the broken jobs before next deploy.",
      affectedResources: failingWorkflows.map((w) => w.name),
      source: sourceTag,
    });
  }

  // 3) Webhook secret — only flag when caller chose to surface it
  if (state.sourceMode !== "disabled" && state.webhookSecretConfigured === false) {
    out.push({
      id: "gh.webhook_secret",
      title: "GitHub webhook secret not configured",
      description: "Webhook delivery should be HMAC-signed so the platform can verify origin.",
      severity: "medium",
      category: "release_governance",
      scope: "github",
      status: "fail",
      evidence: ["GITHUB_WEBHOOK_SECRET unset"],
      remediation: "Set GITHUB_WEBHOOK_SECRET ≥ 32 chars and configure it in the GitHub App / repo webhook.",
      source: sourceTag,
    });
  }

  return out;
}

function unknownCheck(opts: {
  id: string;
  title: string;
  description: string;
  severity: SecurityCheckSeverity;
  category: SecurityCheckCategory;
  scope: SecurityCheckScope;
}): SecurityCheckResult {
  return {
    id: opts.id,
    title: opts.title,
    description: opts.description,
    severity: opts.severity,
    category: opts.category,
    scope: opts.scope,
    status: "unknown",
    evidence: ["source not provided"],
    source: "preview",
  };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const SEV_RANK: Record<SecurityCheckSeverity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

function summarize(results: SecurityCheckResult[]): SecurityScanSummary {
  let pass = 0, fail = 0, warn = 0, unknown = 0, preview = 0;
  let topRisk: SecurityCheckResult | undefined;
  for (const r of results) {
    if (r.status === "pass")    pass++;
    else if (r.status === "fail")    fail++;
    else if (r.status === "warn")    warn++;
    else if (r.status === "unknown") unknown++;
    else if (r.status === "preview") preview++;
    if ((r.status === "fail" || r.status === "preview") && (!topRisk || SEV_RANK[r.severity] > SEV_RANK[topRisk.severity])) {
      topRisk = r;
    }
  }
  const denom = results.length || 1;
  const score = Math.min(1, Math.max(0, (pass + warn * 0.5) / denom));
  return { total: results.length, pass, fail, warn, unknown, preview, score, topRisk };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const SEVERITY_LABEL: Record<SecurityCheckSeverity, string> = {
  info:     "Info",
  low:      "Low",
  medium:   "Medium",
  high:     "High",
  critical: "Critical",
};

export const CATEGORY_LABEL: Record<SecurityCheckCategory, string> = {
  cloud_misconfig:       "Cloud misconfiguration",
  iam_overreach:         "IAM over-reach",
  network_exposure:      "Network exposure",
  encryption_at_rest:    "Encryption at rest",
  backup_resilience:     "Backup / resilience",
  single_region:         "Single-region risk",
  supply_chain:          "Supply chain",
  app_boundary:          "App / platform boundary",
  secret_handling:       "Secret handling",
  audit_gap:             "Audit gap",
  desktop_distribution:  "Desktop distribution",
  desktop_execution:     "Desktop execution",
};

export const STATUS_LABEL: Record<SecurityCheckStatus, string> = {
  pass:    "Pass",
  fail:    "Fail",
  warn:    "Warn",
  unknown: "Unknown",
  preview: "Preview",
};
