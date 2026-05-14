/**
 * Controlled Execution Adapter Interface.
 *
 * Every "actually do something to the customer's infrastructure" code
 * path must go through an `ExecutionAdapter`. The interface refuses to
 * execute unless feature flags, policy, approval, preflight, audit, and
 * rollback / verification are all green.
 *
 * For now, the only production adapter is `PreviewExecutionAdapter`,
 * which never mutates infrastructure. Provider-specific adapters are
 * typed skeletons that report "not yet enabled" instead of running.
 */

import type { CloudProvider } from "@/lib/domain/provider";
import type { ChangeType } from "@/lib/remediation/remediationModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdapterOperation = "dry_run" | "execute" | "verify" | "rollback";

export interface AdapterPrecheckInput {
  featureEnabled: boolean;
  policyApproved: boolean;
  approvalValid: boolean;
  preflightPassed: boolean;
  auditWired: boolean;
  rollbackPresent: boolean;
  verificationPresent: boolean;
  operatorHasPermission: boolean;
}

export interface AdapterPrecheckOutcome {
  allowed: boolean;
  reason: string;
  missing: string[];
}

export interface AdapterOperationResult {
  status: "not_supported" | "preview" | "would_execute" | "executed" | "failed";
  detail: string;
  /** Echo of the adapter id for audit. */
  adapterId: string;
  /** When non-empty, refs the audit pipeline should record. */
  evidenceRefs: { label: string; ref: string }[];
}

export interface ExecutionAdapter {
  id: string;
  getProvider(): CloudProvider | "github" | "desktop" | "platform";
  getSupportedChangeTypes(): ChangeType[];
  getRequiredPermissions(): string[];

  canDryRun(input: AdapterPrecheckInput): AdapterPrecheckOutcome;
  canExecute(input: AdapterPrecheckInput): AdapterPrecheckOutcome;

  dryRun(): Promise<AdapterOperationResult>;
  execute(): Promise<AdapterOperationResult>;
  verify(): Promise<AdapterOperationResult>;
  rollback(): Promise<AdapterOperationResult>;
}

// ---------------------------------------------------------------------------
// Default precheck — every adapter shares this logic.
// ---------------------------------------------------------------------------

export function defaultPrecheck(input: AdapterPrecheckInput, op: AdapterOperation): AdapterPrecheckOutcome {
  const missing: string[] = [];
  if (!input.featureEnabled)         missing.push("feature flag disabled");
  if (!input.policyApproved)         missing.push("policy not approved");
  if (!input.approvalValid)          missing.push("approval missing / invalid");
  if (!input.preflightPassed)        missing.push("preflight not passed");
  if (!input.auditWired)             missing.push("audit pipeline not wired");
  if (!input.rollbackPresent)        missing.push("rollback plan missing");
  if (!input.verificationPresent)    missing.push("verification plan missing");
  if (!input.operatorHasPermission)  missing.push("operator lacks required permission");
  return {
    allowed: missing.length === 0,
    reason: missing.length === 0
      ? `All ${op.replace(/_/g, " ")} prerequisites satisfied.`
      : `Cannot ${op.replace(/_/g, " ")}: ${missing.length} prerequisite(s) missing.`,
    missing,
  };
}

// ---------------------------------------------------------------------------
// Adapters (skeleton implementations)
// ---------------------------------------------------------------------------

abstract class BaseAdapter implements ExecutionAdapter {
  abstract id: string;
  abstract getProvider(): CloudProvider | "github" | "desktop" | "platform";
  abstract getSupportedChangeTypes(): ChangeType[];
  abstract getRequiredPermissions(): string[];

  canDryRun(input: AdapterPrecheckInput): AdapterPrecheckOutcome { return defaultPrecheck(input, "dry_run"); }
  canExecute(input: AdapterPrecheckInput): AdapterPrecheckOutcome { return defaultPrecheck(input, "execute"); }

  async dryRun(): Promise<AdapterOperationResult> {
    return { status: "preview", detail: `${this.id} dry-run is preview-only; no provider call issued.`, adapterId: this.id, evidenceRefs: [] };
  }
  async execute(): Promise<AdapterOperationResult> {
    return { status: "not_supported", detail: `${this.id} execute is not enabled today.`, adapterId: this.id, evidenceRefs: [] };
  }
  async verify(): Promise<AdapterOperationResult> {
    return { status: "preview", detail: `${this.id} verify returns preview-only result.`, adapterId: this.id, evidenceRefs: [] };
  }
  async rollback(): Promise<AdapterOperationResult> {
    return { status: "not_supported", detail: `${this.id} rollback is not enabled today.`, adapterId: this.id, evidenceRefs: [] };
  }
}

export class PreviewExecutionAdapter extends BaseAdapter {
  id = "adapter.preview";
  getProvider() { return "platform" as const; }
  getSupportedChangeTypes(): ChangeType[] { return ["documentation_only", "desktop_review"]; }
  getRequiredPermissions(): string[] { return ["operator"]; }
  // Preview adapter intentionally never escalates beyond `preview`.
  override async execute(): Promise<AdapterOperationResult> {
    return { status: "preview", detail: "Preview adapter never executes.", adapterId: this.id, evidenceRefs: [] };
  }
}

export class AwsExecutionAdapter extends BaseAdapter {
  id = "adapter.aws";
  getProvider() { return "aws" as const; }
  getSupportedChangeTypes(): ChangeType[] {
    return ["security_hardening", "configuration_change", "cost_optimization", "reliability_improvement"];
  }
  getRequiredPermissions(): string[] {
    return ["ec2:*Tags*", "s3:PutBucketPublicAccessBlock", "s3:PutEncryptionConfiguration", "iam:GetRole"];
  }
}

export class AzureExecutionAdapter extends BaseAdapter {
  id = "adapter.azure";
  getProvider() { return "azure" as const; }
  getSupportedChangeTypes(): ChangeType[] {
    return ["security_hardening", "configuration_change", "reliability_improvement"];
  }
  getRequiredPermissions(): string[] { return ["Microsoft.Storage/*", "Microsoft.Network/networkSecurityGroups/*"]; }
}

export class GcpExecutionAdapter extends BaseAdapter {
  id = "adapter.gcp";
  getProvider() { return "gcp" as const; }
  getSupportedChangeTypes(): ChangeType[] {
    return ["security_hardening", "configuration_change", "reliability_improvement"];
  }
  getRequiredPermissions(): string[] { return ["storage.buckets.setIamPolicy", "compute.firewalls.update"]; }
}

export class GitHubReleaseOpsExecutionAdapter extends BaseAdapter {
  id = "adapter.github_releaseops";
  getProvider() { return "github" as const; }
  getSupportedChangeTypes(): ChangeType[] { return ["pipeline_governance"]; }
  getRequiredPermissions(): string[] { return ["repo_admin"]; }
}

export class DesktopReviewAdapter extends BaseAdapter {
  id = "adapter.desktop_review";
  getProvider() { return "desktop" as const; }
  getSupportedChangeTypes(): ChangeType[] { return ["desktop_review"]; }
  getRequiredPermissions(): string[] { return ["operator"]; }
  // Desktop never enables `execute` from the server side — local apply is
  // intentionally blocked, signing isn't ready, and review is the safe path.
  override async execute(): Promise<AdapterOperationResult> {
    return { status: "not_supported", detail: "Desktop apply is intentionally blocked.", adapterId: this.id, evidenceRefs: [] };
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY: Record<string, ExecutionAdapter> = {
  "adapter.preview":            new PreviewExecutionAdapter(),
  "adapter.aws":                new AwsExecutionAdapter(),
  "adapter.azure":              new AzureExecutionAdapter(),
  "adapter.gcp":                new GcpExecutionAdapter(),
  "adapter.github_releaseops":  new GitHubReleaseOpsExecutionAdapter(),
  "adapter.desktop_review":     new DesktopReviewAdapter(),
};

export function getAdapter(id: string): ExecutionAdapter | undefined { return REGISTRY[id]; }
export function listAdapters(): ExecutionAdapter[] { return Object.values(REGISTRY); }

export function adapterForProvider(provider: CloudProvider | "github" | "desktop" | "platform"): ExecutionAdapter {
  if (provider === "aws") return REGISTRY["adapter.aws"];
  if (provider === "azure") return REGISTRY["adapter.azure"];
  if (provider === "gcp") return REGISTRY["adapter.gcp"];
  if (provider === "github") return REGISTRY["adapter.github_releaseops"];
  if (provider === "desktop") return REGISTRY["adapter.desktop_review"];
  return REGISTRY["adapter.preview"];
}
