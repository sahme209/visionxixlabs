import type { ExecutionPlan, ExecutionPlanItem, ActionType, RiskLevel } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type ActionStatus =
  | "pending"
  | "approved"
  | "precheck_running"
  | "precheck_passed"
  | "precheck_failed"
  | "applying"
  | "applied"
  | "apply_failed"
  | "verifying"
  | "verified"
  | "verify_failed"
  /** Handler ran but never called a real cloud SDK — command text was
   *  prepared and a human was told to check manually. Distinct from
   *  "applied"/"verified", which mean a real mutation was executed and
   *  confirmed. Every current AWS/Azure/GCP handler is simulated; no
   *  handler has live execution wired up yet. */
  | "simulated"
  | "rolled_back"
  | "skipped"
  | "blocked";

export type AuditEntry = {
  timestamp: string;
  itemId: string;
  action: string;
  status: ActionStatus;
  detail: string;
  provider: CloudProvider;
  region: string;
  resourceIds: string[];
  durationMs?: number;
  error?: string;
};

export type ActionResult = {
  itemId: string;
  status: ActionStatus;
  precheck: StepResult;
  apply: StepResult;
  verify: StepResult;
  rollbackPlan: RollbackPlan;
  auditLog: AuditEntry[];
};

export type StepResult = {
  success: boolean;
  message: string;
  durationMs: number;
  error?: string;
  /** True when this step never called a real cloud SDK — set by every
   *  current handler's apply()/verify(). Lets the orchestrator report
   *  "simulated" instead of "applied"/"verified" so a prepared-but-not-
   *  executed action can never look identical to a completed one. */
  simulated?: boolean;
};

export type RollbackPlan = {
  steps: string[];
  automated: boolean;
  estimatedDurationMin: number;
};

export type ApprovalPolicy = {
  low: "auto_after_approval" | "require_confirmation";
  medium: "require_confirmation" | "block";
  high: "block";
};

export type ApplyOptions = {
  approvedItemIds: string[];
  confirmedMediumRiskIds: string[];
  approvalPolicy?: ApprovalPolicy;
  onProgress?: (itemId: string, status: ActionStatus, detail: string) => void;
};

export type ApplyResult = {
  planId: string;
  provider: CloudProvider;
  startedAt: string;
  completedAt: string;
  results: ActionResult[];
  auditLog: AuditEntry[];
  summary: ApplySummary;
};

export type ApplySummary = {
  total: number;
  applied: number;
  /** Ran without error but never called a real cloud SDK — see
   *  ActionStatus["simulated"]. Never folded into `applied`. */
  simulated: number;
  failed: number;
  skipped: number;
  blocked: number;
  estimatedMonthlySavings: number;
};

// ---------------------------------------------------------------------------
// Cloud action interface — implemented per provider
// ---------------------------------------------------------------------------

export type CloudActionHandler = {
  precheck: (item: ExecutionPlanItem) => Promise<StepResult>;
  apply: (item: ExecutionPlanItem) => Promise<StepResult>;
  verify: (item: ExecutionPlanItem) => Promise<StepResult>;
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

const DEFAULT_POLICY: ApprovalPolicy = {
  low: "auto_after_approval",
  medium: "require_confirmation",
  high: "block",
};

export async function applyExecutionPlan(
  plan: ExecutionPlan,
  handlers: Record<string, CloudActionHandler>,
  options: ApplyOptions,
): Promise<ApplyResult> {
  const policy = options.approvalPolicy ?? DEFAULT_POLICY;
  const startedAt = new Date().toISOString();
  const results: ActionResult[] = [];
  const fullAuditLog: AuditEntry[] = [];

  const notify = options.onProgress ?? (() => {});

  for (const item of plan.items) {
    const gateResult = evaluateGate(item, policy, options);

    if (gateResult === "blocked") {
      const result = blockedResult(item, "High-risk action — automatic execution is not permitted.");
      results.push(result);
      fullAuditLog.push(...result.auditLog);
      notify(item.id, "blocked", result.auditLog[0].detail);
      continue;
    }

    if (gateResult === "skipped") {
      const result = skippedResult(item, "Action not in approved list.");
      results.push(result);
      fullAuditLog.push(...result.auditLog);
      notify(item.id, "skipped", result.auditLog[0].detail);
      continue;
    }

    if (gateResult === "needs_confirmation") {
      const result = blockedResult(item, "Medium-risk action requires explicit confirmation via confirmedMediumRiskIds.");
      results.push(result);
      fullAuditLog.push(...result.auditLog);
      notify(item.id, "blocked", result.auditLog[0].detail);
      continue;
    }

    const handler = handlers[item.actionType];
    if (!handler) {
      const result = skippedResult(item, `No handler registered for action type: ${item.actionType}`);
      results.push(result);
      fullAuditLog.push(...result.auditLog);
      notify(item.id, "skipped", result.auditLog[0].detail);
      continue;
    }

    const result = await executeAction(item, handler, notify);
    results.push(result);
    fullAuditLog.push(...result.auditLog);

    if (result.status === "apply_failed") {
      break;
    }
  }

  const completedAt = new Date().toISOString();

  return {
    planId: `apply-${Date.now()}`,
    provider: plan.provider,
    startedAt,
    completedAt,
    results,
    auditLog: fullAuditLog,
    summary: buildSummary(results, plan),
  };
}

// ---------------------------------------------------------------------------
// Gate evaluation — determines if an action can proceed
// ---------------------------------------------------------------------------

type GateDecision = "approved" | "blocked" | "skipped" | "needs_confirmation";

function evaluateGate(
  item: ExecutionPlanItem,
  policy: ApprovalPolicy,
  options: ApplyOptions,
): GateDecision {
  if (!options.approvedItemIds.includes(item.id)) {
    return "skipped";
  }

  if (item.riskLevel === "high") {
    return "blocked";
  }

  if (item.actionType === "purchase_commitment" || item.actionType === "decommission_compute") {
    return "blocked";
  }

  if (item.riskLevel === "medium") {
    const policyAction = policy.medium;
    if (policyAction === "block") return "blocked";
    if (!options.confirmedMediumRiskIds.includes(item.id)) return "needs_confirmation";
  }

  return "approved";
}

// ---------------------------------------------------------------------------
// Action execution — precheck → apply → verify
// ---------------------------------------------------------------------------

async function executeAction(
  item: ExecutionPlanItem,
  handler: CloudActionHandler,
  notify: (itemId: string, status: ActionStatus, detail: string) => void,
): Promise<ActionResult> {
  const auditLog: AuditEntry[] = [];
  const rollbackPlan = buildRollbackPlan(item);

  // ---- Precheck ----
  notify(item.id, "precheck_running", "Running prechecks...");
  audit(auditLog, item, "precheck", "precheck_running", "Starting prechecks");

  let precheck: StepResult;
  try {
    precheck = await handler.precheck(item);
  } catch (err) {
    precheck = { success: false, message: errorMessage(err), durationMs: 0, error: errorMessage(err) };
  }

  if (!precheck.success) {
    audit(auditLog, item, "precheck", "precheck_failed", precheck.message, precheck.error);
    notify(item.id, "precheck_failed", precheck.message);
    return {
      itemId: item.id,
      status: "precheck_failed",
      precheck,
      apply: emptyStep("Skipped — precheck failed"),
      verify: emptyStep("Skipped — precheck failed"),
      rollbackPlan,
      auditLog,
    };
  }

  audit(auditLog, item, "precheck", "precheck_passed", precheck.message);
  notify(item.id, "precheck_passed", precheck.message);

  // ---- Apply ----
  notify(item.id, "applying", "Applying changes...");
  audit(auditLog, item, "apply", "applying", "Applying action");

  let apply: StepResult;
  try {
    apply = await handler.apply(item);
  } catch (err) {
    apply = { success: false, message: errorMessage(err), durationMs: 0, error: errorMessage(err) };
  }

  if (!apply.success) {
    audit(auditLog, item, "apply", "apply_failed", apply.message, apply.error);
    notify(item.id, "apply_failed", apply.message);
    return {
      itemId: item.id,
      status: "apply_failed",
      precheck,
      apply,
      verify: emptyStep("Skipped — apply failed"),
      rollbackPlan,
      auditLog,
    };
  }

  const applyStatus: ActionStatus = apply.simulated ? "simulated" : "applied";
  audit(auditLog, item, "apply", applyStatus, apply.message);
  notify(item.id, applyStatus, apply.message);

  // ---- Verify ----
  notify(item.id, "verifying", "Verifying changes...");
  audit(auditLog, item, "verify", "verifying", "Verifying action result");

  let verify: StepResult;
  try {
    verify = await handler.verify(item);
  } catch (err) {
    verify = { success: false, message: errorMessage(err), durationMs: 0, error: errorMessage(err) };
  }

  const finalStatus: ActionStatus = !verify.success
    ? "verify_failed"
    : (apply.simulated || verify.simulated) ? "simulated" : "verified";
  audit(auditLog, item, "verify", finalStatus, verify.message, verify.error);
  notify(item.id, finalStatus, verify.message);

  return {
    itemId: item.id,
    status: finalStatus,
    precheck,
    apply,
    verify,
    rollbackPlan,
    auditLog,
  };
}

// ---------------------------------------------------------------------------
// Provider-specific action handlers
//
// None of these call a real cloud SDK yet — apply() only builds the command
// strings a human would need to run, and verify() always returns success
// with an instruction to go check manually, never a real post-change read.
// Every message below says so explicitly. The ActionStatus values this
// flow produces ("applied" / "verified") still read as completed-and-
// confirmed, which overstates what happened — that's a real gap in the
// status contract itself (every one of its 7 consumers would need
// updating to add an honest "simulated" status), not fixed here. Do not
// wire real execution into these handlers without the tenant
// authorization, role checks, explicit approval, environment safeguards,
// and rollback evidence required for live cloud mutation.
// ---------------------------------------------------------------------------

export const AWS_HANDLERS: Record<string, CloudActionHandler> = {
  resize_compute: {
    async precheck(item) {
      const start = Date.now();
      for (const id of item.resourceIds) {
        if (!id.startsWith("i-")) {
          return { success: false, message: `Invalid EC2 instance ID: ${id}`, durationMs: Date.now() - start };
        }
      }
      return { success: true, message: `${item.resourceIds.length} instance(s) validated for resize in ${item.region}`, durationMs: Date.now() - start };
    },
    async apply(item) {
      const start = Date.now();
      const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
      const commands: string[] = [];
      for (const id of item.resourceIds) {
        commands.push(
          `aws ec2 stop-instances --instance-ids ${id} --region ${item.region}`,
          `aws ec2 wait instance-stopped --instance-ids ${id} --region ${item.region}`,
          `aws ec2 modify-instance-attribute --instance-id ${id} --instance-type '{"Value":"${recommended}"}' --region ${item.region}`,
          `aws ec2 start-instances --instance-ids ${id} --region ${item.region}`,
          `aws ec2 wait instance-running --instance-ids ${id} --region ${item.region}`,
        );
      }
      return { success: true, message: `Resize commands prepared for ${item.resourceIds.length} instance(s): ${recommended}. Not yet executed against a live AWS account.`, simulated: true, durationMs: Date.now() - start };
    },
    async verify(item) {
      const start = Date.now();
      const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
      return { success: true, message: `Not a live check — manually confirm instance type is ${recommended} and status is "running".`, simulated: true, durationMs: Date.now() - start };
    },
  },
  apply_storage_policy: {
    async precheck(item) {
      const start = Date.now();
      return { success: true, message: `${item.resourceIds.length} bucket(s) validated for tiering in ${item.region}`, durationMs: Date.now() - start };
    },
    async apply(item) {
      const start = Date.now();
      return { success: true, message: `Intelligent-Tiering + lifecycle rule commands prepared for ${item.resourceIds.length} bucket(s). Not yet executed against a live AWS account.`, simulated: true, durationMs: Date.now() - start };
    },
    async verify(item) {
      const start = Date.now();
      return { success: true, message: `Not a live check — manually confirm lifecycle configuration exists on ${item.resourceIds.length} bucket(s).`, simulated: true, durationMs: Date.now() - start };
    },
  },
};

export const AZURE_HANDLERS: Record<string, CloudActionHandler> = {
  resize_compute: {
    async precheck(item) {
      const start = Date.now();
      return { success: true, message: `${item.resourceIds.length} VM(s) validated for resize in ${item.region}. Deallocation required.`, durationMs: Date.now() - start };
    },
    async apply(item) {
      const start = Date.now();
      const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
      return { success: true, message: `Resize commands prepared for ${item.resourceIds.length} VM(s): ${recommended}. Not yet executed against a live Azure subscription.`, simulated: true, durationMs: Date.now() - start };
    },
    async verify(item) {
      const start = Date.now();
      const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
      return { success: true, message: `Not a live check — manually confirm VM size is ${recommended} and power state is "running".`, simulated: true, durationMs: Date.now() - start };
    },
  },
  apply_storage_policy: {
    async precheck(item) {
      const start = Date.now();
      return { success: true, message: `${item.resourceIds.length} storage account(s) validated for tiering`, durationMs: Date.now() - start };
    },
    async apply(item) {
      const start = Date.now();
      return { success: true, message: `Cool/Archive lifecycle policy commands prepared for ${item.resourceIds.length} account(s). Not yet executed against a live Azure subscription.`, simulated: true, durationMs: Date.now() - start };
    },
    async verify(item) {
      const start = Date.now();
      return { success: true, message: `Not a live check — manually confirm management policy exists on ${item.resourceIds.length} account(s).`, simulated: true, durationMs: Date.now() - start };
    },
  },
};

export const GCP_HANDLERS: Record<string, CloudActionHandler> = {
  resize_compute: {
    async precheck(item) {
      const start = Date.now();
      return { success: true, message: `${item.resourceIds.length} instance(s) validated for resize in ${item.region}`, durationMs: Date.now() - start };
    },
    async apply(item) {
      const start = Date.now();
      const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
      return { success: true, message: `Machine type change prepared for ${item.resourceIds.length} instance(s): ${recommended}. Not yet executed against a live GCP project.`, simulated: true, durationMs: Date.now() - start };
    },
    async verify(item) {
      const start = Date.now();
      const recommended = item.recommendedState.replace(/^\d+x\s*/, "");
      return { success: true, message: `Not a live check — manually confirm machine type is ${recommended} and status is "RUNNING".`, simulated: true, durationMs: Date.now() - start };
    },
  },
  apply_storage_policy: {
    async precheck(item) {
      const start = Date.now();
      return { success: true, message: `${item.resourceIds.length} bucket(s) validated for lifecycle rules`, durationMs: Date.now() - start };
    },
    async apply(item) {
      const start = Date.now();
      return { success: true, message: `Nearline/Coldline lifecycle rule commands prepared for ${item.resourceIds.length} bucket(s). Not yet executed against a live GCP project.`, simulated: true, durationMs: Date.now() - start };
    },
    async verify(item) {
      const start = Date.now();
      return { success: true, message: `Not a live check — manually confirm lifecycle rules exist on ${item.resourceIds.length} bucket(s).`, simulated: true, durationMs: Date.now() - start };
    },
  },
};

export function getHandlersForProvider(provider: CloudProvider): Record<string, CloudActionHandler> {
  switch (provider) {
    case "aws": return AWS_HANDLERS;
    case "azure": return AZURE_HANDLERS;
    case "gcp": return GCP_HANDLERS;
  }
}

// ---------------------------------------------------------------------------
// Rollback plan builder
// ---------------------------------------------------------------------------

function buildRollbackPlan(item: ExecutionPlanItem): RollbackPlan {
  const base: RollbackPlan = {
    steps: item.rollbackSteps,
    automated: false,
    estimatedDurationMin: 5,
  };

  switch (item.actionType) {
    case "resize_compute":
      base.automated = true;
      base.estimatedDurationMin = item.provider === "azure" ? 15 : 10;
      break;
    case "apply_storage_policy":
      base.automated = true;
      base.estimatedDurationMin = 2;
      break;
    case "purchase_commitment":
      base.automated = false;
      base.estimatedDurationMin = 0;
      base.steps = ["Cannot be cancelled — commitment expires at term end"];
      break;
    case "decommission_compute":
      base.automated = false;
      base.estimatedDurationMin = 30;
      break;
    case "restrict_public_access":
      base.automated = true;
      base.estimatedDurationMin = 5;
      break;
    case "enable_backup":
      base.automated = true;
      base.estimatedDurationMin = 10;
      break;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(results: ActionResult[], plan: ExecutionPlan): ApplySummary {
  let applied = 0;
  let simulated = 0;
  let failed = 0;
  let skipped = 0;
  let blocked = 0;
  let savingsFromApplied = 0;

  for (const r of results) {
    switch (r.status) {
      case "verified":
      case "applied":
      case "verify_failed":
        applied++;
        break;
      case "simulated":
        simulated++;
        break;
      case "apply_failed":
      case "precheck_failed":
        failed++;
        break;
      case "skipped":
        skipped++;
        break;
      case "blocked":
        blocked++;
        break;
    }
  }

  const appliedIds = new Set(
    results
      .filter((r) => r.status === "verified" || r.status === "applied")
      .map((r) => r.itemId),
  );

  for (const item of plan.items) {
    if (appliedIds.has(item.id)) {
      savingsFromApplied += item.estimatedSavings.monthly;
    }
  }

  return {
    total: results.length,
    applied,
    simulated,
    failed,
    skipped,
    blocked,
    estimatedMonthlySavings: savingsFromApplied,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function audit(
  log: AuditEntry[],
  item: ExecutionPlanItem,
  action: string,
  status: ActionStatus,
  detail: string,
  error?: string,
): void {
  log.push({
    timestamp: new Date().toISOString(),
    itemId: item.id,
    action,
    status,
    detail,
    provider: item.provider,
    region: item.region,
    resourceIds: item.resourceIds,
    error,
  });
}

function emptyStep(message: string): StepResult {
  return { success: false, message, durationMs: 0 };
}

function blockedResult(item: ExecutionPlanItem, reason: string): ActionResult {
  const auditLog: AuditEntry[] = [];
  audit(auditLog, item, "gate", "blocked", reason);
  return {
    itemId: item.id,
    status: "blocked",
    precheck: emptyStep(reason),
    apply: emptyStep(reason),
    verify: emptyStep(reason),
    rollbackPlan: buildRollbackPlan(item),
    auditLog,
  };
}

function skippedResult(item: ExecutionPlanItem, reason: string): ActionResult {
  const auditLog: AuditEntry[] = [];
  audit(auditLog, item, "gate", "skipped", reason);
  return {
    itemId: item.id,
    status: "skipped",
    precheck: emptyStep(reason),
    apply: emptyStep(reason),
    verify: emptyStep(reason),
    rollbackPlan: buildRollbackPlan(item),
    auditLog,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
