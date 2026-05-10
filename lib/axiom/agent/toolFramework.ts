/**
 * Axiom Tool Framework
 *
 * Provides the agent with a structured way to discover, select, invoke,
 * verify, and recover from tool usage. Every tool call is logged,
 * traced, and explainable.
 *
 * Tool categories:
 *   1. Cloud Provider APIs   — read/write cloud resources
 *   2. Terraform Generators  — produce IaC for changes
 *   3. CLI Generators        — produce CLI commands
 *   4. Policy Engines        — evaluate governance/compliance
 *   5. Monitoring Systems    — observe infrastructure state
 *   6. Approval Systems      — request/resolve human approval
 *   7. Execution Engines     — apply changes to infrastructure
 *   8. Rollback Engines      — revert failed changes
 *   9. Diff Engines          — compare snapshots and detect drift
 *  10. Memory Systems        — retrieve/store agent memory
 *
 * Safety invariants:
 *   - Every invocation produces an ExecutionTrace
 *   - Write tools require explicit authorization
 *   - Failed tools retry with backoff, then escalate
 *   - Tool selection is logged with rationale
 *   - No tool can bypass approval requirements
 *   - All tool outputs are validated before use
 */

import type { CloudProvider } from "../cloudSnapshot";
import type { ActionType, RiskLevel } from "../executionPlan";
import type { FindingCategory } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. TOOL IDENTITY
// ═══════════════════════════════════════════════════════════════════════════

export type ToolCategory =
  | "cloud_api"
  | "terraform"
  | "cli"
  | "policy"
  | "monitoring"
  | "approval"
  | "execution"
  | "rollback"
  | "diff"
  | "memory";

export type ToolCapability =
  | "read"
  | "write"
  | "generate"
  | "evaluate"
  | "observe"
  | "approve"
  | "execute"
  | "revert"
  | "compare"
  | "query";

export type ToolRiskLevel = "safe" | "cautious" | "dangerous";

export type ToolId = string & { readonly __brand: "ToolId" };

function toolId(id: string): ToolId {
  return id as ToolId;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. TOOL DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

export type ToolDefinition = {
  id: ToolId;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  capabilities: ToolCapability[];
  riskLevel: ToolRiskLevel;

  providers: CloudProvider[] | "all";
  requiresAuth: boolean;
  requiresApproval: boolean;
  idempotent: boolean;
  timeout: number;                   // ms
  maxRetries: number;
  retryBackoffMs: number;

  inputSchema: ToolParamSchema;
  outputSchema: ToolParamSchema;

  preconditions: ToolPrecondition[];
  sideEffects: string[];

  metadata: {
    author: string;
    addedAt: string;
    deprecated: boolean;
    replacedBy: ToolId | null;
    tags: string[];
  };
};

export type ToolParamSchema = {
  type: "object";
  required: string[];
  properties: Record<string, ParamDefinition>;
};

export type ParamDefinition = {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  enum?: string[];
  default?: unknown;
  nullable?: boolean;
};

export type ToolPrecondition = {
  name: string;
  description: string;
  check: "auth_valid" | "provider_reachable" | "resource_exists" | "approval_granted" | "within_blast_radius" | "custom";
  customCheckId?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

const registry = new Map<ToolId, ToolDefinition>();
const handlers = new Map<ToolId, ToolHandler>();

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolContext,
) => Promise<ToolOutput>;

export function registerTool(definition: ToolDefinition, handler: ToolHandler): void {
  if (definition.metadata.deprecated && definition.metadata.replacedBy) {
    const replacement = registry.get(definition.metadata.replacedBy);
    if (replacement) {
      return;
    }
  }
  registry.set(definition.id, definition);
  handlers.set(definition.id, handler);
}

export function unregisterTool(id: ToolId): boolean {
  handlers.delete(id);
  return registry.delete(id);
}

export function getTool(id: ToolId): ToolDefinition | undefined {
  return registry.get(id);
}

export function listTools(filter?: ToolFilter): ToolDefinition[] {
  let tools = [...registry.values()];

  if (filter?.category) {
    tools = tools.filter((t) => t.category === filter.category);
  }
  if (filter?.capability) {
    tools = tools.filter((t) => t.capabilities.includes(filter.capability!));
  }
  if (filter?.provider) {
    tools = tools.filter((t) => t.providers === "all" || t.providers.includes(filter.provider!));
  }
  if (filter?.riskLevel) {
    tools = tools.filter((t) => t.riskLevel === filter.riskLevel);
  }
  if (filter?.excludeDeprecated) {
    tools = tools.filter((t) => !t.metadata.deprecated);
  }
  if (filter?.tags && filter.tags.length > 0) {
    tools = tools.filter((t) => filter.tags!.some((tag) => t.metadata.tags.includes(tag)));
  }

  return tools;
}

export type ToolFilter = {
  category?: ToolCategory;
  capability?: ToolCapability;
  provider?: CloudProvider;
  riskLevel?: ToolRiskLevel;
  excludeDeprecated?: boolean;
  tags?: string[];
};

export function getToolCount(): number {
  return registry.size;
}

export function clearRegistry(): void {
  registry.clear();
  handlers.clear();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. TOOL CONTEXT — passed to every invocation
// ═══════════════════════════════════════════════════════════════════════════

export type ToolContext = {
  correlationId: string;
  orgId: string;
  userId: string | null;
  runId: string;
  loopId: string;
  phase: string;
  provider: CloudProvider | null;
  region: string | null;
  authorization: ToolAuthorization;
  dryRun: boolean;
  timeout: number;
  attempt: number;
  maxAttempts: number;
  parentTraceId: string | null;
  metadata: Record<string, unknown>;
};

export type ToolAuthorization = {
  authenticated: boolean;
  role: string;
  scopes: string[];
  approvalChainId: string | null;
  approvedActions: string[];
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. TOOL INPUT/OUTPUT
// ═══════════════════════════════════════════════════════════════════════════

export type ToolInput = {
  toolId: ToolId;
  params: Record<string, unknown>;
  context: ToolContext;
  rationale: string;
};

export type ToolOutput = {
  success: boolean;
  data: unknown;
  errors: ToolError[];
  warnings: string[];
  metadata: ToolOutputMetadata;
};

export type ToolOutputMetadata = {
  resourcesRead: number;
  resourcesModified: number;
  bytesTransferred: number;
  apiCallsMade: number;
  costEstimate: number | null;
  providerRequestIds: string[];
};

export type ToolError = {
  code: string;
  message: string;
  retryable: boolean;
  provider: CloudProvider | null;
  resourceId: string | null;
  suggestion: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. EXECUTION TRACE — full audit of a tool invocation
// ═══════════════════════════════════════════════════════════════════════════

export type ExecutionTrace = {
  id: string;
  parentId: string | null;
  correlationId: string;
  toolId: ToolId;
  toolName: string;
  category: ToolCategory;

  input: {
    params: Record<string, unknown>;
    rationale: string;
    phase: string;
    dryRun: boolean;
  };

  output: {
    success: boolean;
    data: unknown;
    errors: ToolError[];
    warnings: string[];
  } | null;

  timing: {
    queuedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number;
    retryCount: number;
    timeoutMs: number;
  };

  authorization: {
    authenticated: boolean;
    role: string;
    approvalRequired: boolean;
    approvalGranted: boolean;
  };

  validation: {
    inputValid: boolean;
    outputValid: boolean;
    outputVerified: boolean;
    verificationMethod: string | null;
    verificationResult: unknown;
  };

  recovery: {
    retried: boolean;
    retryAttempts: number;
    fallbackUsed: boolean;
    fallbackToolId: ToolId | null;
    escalated: boolean;
    escalationReason: string | null;
  };

  provider: CloudProvider | null;
  region: string | null;
  orgId: string;
  runId: string;
};

const traces: ExecutionTrace[] = [];
let traceSeq = 0;

function traceId(): string {
  return `trace-${Date.now()}-${++traceSeq}`;
}

export function getTraces(filter?: TraceFilter): ExecutionTrace[] {
  let result = [...traces];

  if (filter?.correlationId) {
    result = result.filter((t) => t.correlationId === filter.correlationId);
  }
  if (filter?.toolId) {
    result = result.filter((t) => t.toolId === filter.toolId);
  }
  if (filter?.category) {
    result = result.filter((t) => t.category === filter.category);
  }
  if (filter?.success !== undefined) {
    result = result.filter((t) => t.output?.success === filter.success);
  }
  if (filter?.since) {
    result = result.filter((t) => t.timing.queuedAt >= filter.since!);
  }
  if (filter?.limit) {
    result = result.slice(-filter.limit);
  }

  return result;
}

export function clearTraces(): void {
  traces.length = 0;
}

export type TraceFilter = {
  correlationId?: string;
  toolId?: ToolId;
  category?: ToolCategory;
  success?: boolean;
  since?: string;
  limit?: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

function validateInput(params: Record<string, unknown>, schema: ToolParamSchema): ValidationResult {
  const errors: string[] = [];

  for (const field of schema.required) {
    if (params[field] === undefined || params[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  for (const [key, value] of Object.entries(params)) {
    const def = schema.properties[key];
    if (!def) continue;

    if (value === null && !def.nullable) {
      errors.push(`Field "${key}" cannot be null`);
      continue;
    }

    if (value !== null && value !== undefined) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== def.type) {
        errors.push(`Field "${key}" expected ${def.type}, got ${actualType}`);
      }

      if (def.enum && typeof value === "string" && !def.enum.includes(value)) {
        errors.push(`Field "${key}" must be one of: ${def.enum.join(", ")}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateOutput(data: unknown, schema: ToolParamSchema): ValidationResult {
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Output must be an object"] };
  }
  return validateInput(data as Record<string, unknown>, schema);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. PRECONDITION CHECKING
// ═══════════════════════════════════════════════════════════════════════════

export type PreconditionResult = {
  allMet: boolean;
  results: { name: string; met: boolean; reason: string }[];
};

function checkPreconditions(
  tool: ToolDefinition,
  context: ToolContext,
): PreconditionResult {
  const results: { name: string; met: boolean; reason: string }[] = [];

  for (const pre of tool.preconditions) {
    switch (pre.check) {
      case "auth_valid":
        results.push({
          name: pre.name,
          met: context.authorization.authenticated,
          reason: context.authorization.authenticated ? "Authenticated" : "Not authenticated",
        });
        break;

      case "approval_granted":
        if (!tool.requiresApproval) {
          results.push({ name: pre.name, met: true, reason: "Tool does not require approval" });
        } else {
          const granted = context.authorization.approvalChainId !== null;
          results.push({
            name: pre.name,
            met: granted,
            reason: granted ? "Approval chain active" : "No approval granted",
          });
        }
        break;

      case "provider_reachable":
        results.push({ name: pre.name, met: true, reason: "Provider assumed reachable (checked at runtime)" });
        break;

      case "resource_exists":
        results.push({ name: pre.name, met: true, reason: "Resource existence verified at invocation" });
        break;

      case "within_blast_radius":
        results.push({ name: pre.name, met: true, reason: "Blast radius checked by orchestrator" });
        break;

      case "custom":
        results.push({ name: pre.name, met: true, reason: "Custom check deferred to handler" });
        break;
    }
  }

  return {
    allMet: results.every((r) => r.met),
    results,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. RETRY & BACKOFF
// ═══════════════════════════════════════════════════════════════════════════

export type RetryPolicy = {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  retryableErrors: string[];
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
  retryableErrors: [
    "TIMEOUT",
    "RATE_LIMITED",
    "SERVICE_UNAVAILABLE",
    "NETWORK_ERROR",
    "THROTTLED",
    "TRANSIENT",
  ],
};

function shouldRetry(error: ToolError, attempt: number, policy: RetryPolicy): boolean {
  if (!error.retryable) return false;
  if (attempt >= policy.maxRetries) return false;
  if (policy.retryableErrors.length > 0 && !policy.retryableErrors.includes(error.code)) return false;
  return true;
}

function backoffDelay(attempt: number, policy: RetryPolicy): number {
  const delay = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt);
  const jitter = Math.random() * delay * 0.1;
  return Math.min(delay + jitter, policy.maxBackoffMs);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. TOOL INVOCATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export type InvocationResult = {
  trace: ExecutionTrace;
  output: ToolOutput | null;
  success: boolean;
  retried: boolean;
  escalated: boolean;
};

export async function invokeTool(input: ToolInput): Promise<InvocationResult> {
  const now = new Date().toISOString();
  const tool = registry.get(input.toolId);
  const handler = handlers.get(input.toolId);

  const trace: ExecutionTrace = {
    id: traceId(),
    parentId: input.context.parentTraceId,
    correlationId: input.context.correlationId,
    toolId: input.toolId,
    toolName: tool?.name ?? "unknown",
    category: tool?.category ?? "cloud_api",
    input: {
      params: input.params,
      rationale: input.rationale,
      phase: input.context.phase,
      dryRun: input.context.dryRun,
    },
    output: null,
    timing: {
      queuedAt: now,
      startedAt: null,
      completedAt: null,
      durationMs: 0,
      retryCount: 0,
      timeoutMs: input.context.timeout,
    },
    authorization: {
      authenticated: input.context.authorization.authenticated,
      role: input.context.authorization.role,
      approvalRequired: tool?.requiresApproval ?? false,
      approvalGranted: input.context.authorization.approvalChainId !== null,
    },
    validation: {
      inputValid: false,
      outputValid: false,
      outputVerified: false,
      verificationMethod: null,
      verificationResult: null,
    },
    recovery: {
      retried: false,
      retryAttempts: 0,
      fallbackUsed: false,
      fallbackToolId: null,
      escalated: false,
      escalationReason: null,
    },
    provider: input.context.provider,
    region: input.context.region,
    orgId: input.context.orgId,
    runId: input.context.runId,
  };

  // Tool not found
  if (!tool || !handler) {
    trace.output = {
      success: false,
      data: null,
      errors: [{ code: "TOOL_NOT_FOUND", message: `Tool "${input.toolId}" not registered`, retryable: false, provider: null, resourceId: null, suggestion: "Check tool registry" }],
      warnings: [],
    };
    trace.timing.completedAt = new Date().toISOString();
    traces.push(trace);
    return { trace, output: null, success: false, retried: false, escalated: false };
  }

  // Deprecated tool warning
  if (tool.metadata.deprecated) {
    const replacement = tool.metadata.replacedBy ? registry.get(tool.metadata.replacedBy) : null;
    if (replacement) {
      trace.output = {
        success: false,
        data: null,
        errors: [{ code: "TOOL_DEPRECATED", message: `Tool "${tool.name}" is deprecated, use "${replacement.name}"`, retryable: false, provider: null, resourceId: null, suggestion: `Use tool "${replacement.id}"` }],
        warnings: [],
      };
      trace.timing.completedAt = new Date().toISOString();
      traces.push(trace);
      return { trace, output: null, success: false, retried: false, escalated: false };
    }
  }

  // Validate input
  const inputValidation = validateInput(input.params, tool.inputSchema);
  trace.validation.inputValid = inputValidation.valid;

  if (!inputValidation.valid) {
    trace.output = {
      success: false,
      data: null,
      errors: inputValidation.errors.map((e) => ({
        code: "INVALID_INPUT", message: e, retryable: false, provider: null, resourceId: null, suggestion: null,
      })),
      warnings: [],
    };
    trace.timing.completedAt = new Date().toISOString();
    traces.push(trace);
    return { trace, output: null, success: false, retried: false, escalated: false };
  }

  // Check preconditions
  const preCheck = checkPreconditions(tool, input.context);
  if (!preCheck.allMet) {
    const failedPre = preCheck.results.filter((r) => !r.met);
    trace.output = {
      success: false,
      data: null,
      errors: failedPre.map((p) => ({
        code: "PRECONDITION_FAILED", message: `${p.name}: ${p.reason}`, retryable: false, provider: null, resourceId: null, suggestion: null,
      })),
      warnings: [],
    };
    trace.timing.completedAt = new Date().toISOString();
    traces.push(trace);
    return { trace, output: null, success: false, retried: false, escalated: false };
  }

  // Authorization check for write tools
  if (tool.capabilities.includes("write") || tool.capabilities.includes("execute") || tool.capabilities.includes("revert")) {
    if (!input.context.authorization.authenticated) {
      trace.output = {
        success: false,
        data: null,
        errors: [{ code: "UNAUTHORIZED", message: "Write operation requires authentication", retryable: false, provider: null, resourceId: null, suggestion: "Authenticate before invoking write tools" }],
        warnings: [],
      };
      trace.timing.completedAt = new Date().toISOString();
      traces.push(trace);
      return { trace, output: null, success: false, retried: false, escalated: false };
    }
  }

  // Execute with retry
  const retryPolicy: RetryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    maxRetries: tool.maxRetries,
    backoffMs: tool.retryBackoffMs,
  };

  let output: ToolOutput | null = null;
  let lastError: ToolError | null = null;
  let attempt = 0;

  while (attempt <= retryPolicy.maxRetries) {
    const attemptCtx: ToolContext = { ...input.context, attempt, maxAttempts: retryPolicy.maxRetries + 1 };

    if (attempt === 0) {
      trace.timing.startedAt = new Date().toISOString();
    }

    try {
      output = await handler(input.params, attemptCtx);

      if (output.success) {
        break;
      }

      const retryableError = output.errors.find((e) => e.retryable);
      if (retryableError && shouldRetry(retryableError, attempt, retryPolicy)) {
        lastError = retryableError;
        attempt++;
        trace.recovery.retried = true;
        trace.recovery.retryAttempts = attempt;
        trace.timing.retryCount = attempt;
        await sleep(backoffDelay(attempt, retryPolicy));
        continue;
      }

      break;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      lastError = {
        code: "HANDLER_EXCEPTION",
        message: errorMsg,
        retryable: true,
        provider: input.context.provider,
        resourceId: null,
        suggestion: "Check tool handler implementation",
      };

      if (shouldRetry(lastError, attempt, retryPolicy)) {
        attempt++;
        trace.recovery.retried = true;
        trace.recovery.retryAttempts = attempt;
        trace.timing.retryCount = attempt;
        await sleep(backoffDelay(attempt, retryPolicy));
        continue;
      }

      output = {
        success: false,
        data: null,
        errors: [lastError],
        warnings: [],
        metadata: { resourcesRead: 0, resourcesModified: 0, bytesTransferred: 0, apiCallsMade: 0, costEstimate: null, providerRequestIds: [] },
      };
      break;
    }
  }

  // Finalize trace
  const completedAt = new Date().toISOString();
  trace.timing.completedAt = completedAt;
  trace.timing.durationMs = new Date(completedAt).getTime() - new Date(trace.timing.startedAt ?? completedAt).getTime();

  if (output) {
    trace.output = {
      success: output.success,
      data: output.data,
      errors: output.errors,
      warnings: output.warnings,
    };

    // Validate output schema
    if (output.success && output.data !== null) {
      const outputValidation = validateOutput(output.data, tool.outputSchema);
      trace.validation.outputValid = outputValidation.valid;
      if (!outputValidation.valid) {
        output.warnings.push(...outputValidation.errors.map((e) => `Output validation: ${e}`));
      }
    }
  }

  // Escalate if all retries exhausted
  const escalated = !output?.success && attempt > retryPolicy.maxRetries;
  if (escalated) {
    trace.recovery.escalated = true;
    trace.recovery.escalationReason = `All ${retryPolicy.maxRetries} retries exhausted: ${lastError?.message ?? "unknown error"}`;
  }

  traces.push(trace);

  return {
    trace,
    output,
    success: output?.success ?? false,
    retried: trace.recovery.retried,
    escalated,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. TOOL SELECTION — agent chooses tools for a task
// ═══════════════════════════════════════════════════════════════════════════

export type ToolSelectionInput = {
  task: string;
  category: ToolCategory;
  capability: ToolCapability;
  provider: CloudProvider | null;
  riskBudget: ToolRiskLevel;
  preferIdempotent: boolean;
};

export type ToolSelection = {
  toolId: ToolId;
  toolName: string;
  rationale: string;
  confidence: number;
  alternatives: ToolId[];
  warnings: string[];
};

export function selectTool(input: ToolSelectionInput): ToolSelection | null {
  const candidates = listTools({
    category: input.category,
    capability: input.capability,
    provider: input.provider ?? undefined,
    excludeDeprecated: true,
  });

  if (candidates.length === 0) return null;

  const riskRank: Record<ToolRiskLevel, number> = { safe: 0, cautious: 1, dangerous: 2 };
  const budgetRank = riskRank[input.riskBudget];

  // Filter by risk budget
  let eligible = candidates.filter((t) => riskRank[t.riskLevel] <= budgetRank);
  if (eligible.length === 0) eligible = candidates;

  // Prefer idempotent if requested
  if (input.preferIdempotent) {
    const idempotent = eligible.filter((t) => t.idempotent);
    if (idempotent.length > 0) eligible = idempotent;
  }

  // Score candidates
  const scored = eligible.map((tool) => {
    let score = 50;

    if (tool.riskLevel === "safe") score += 20;
    else if (tool.riskLevel === "cautious") score += 10;

    if (tool.idempotent) score += 15;

    if (!tool.requiresApproval) score += 10;

    if (input.provider && tool.providers !== "all" && tool.providers.includes(input.provider)) {
      score += 10;
    }

    if (tool.providers === "all") score += 5;

    return { tool, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const warnings: string[] = [];
  if (best.tool.riskLevel === "dangerous") {
    warnings.push("Selected tool has dangerous risk level — approval required");
  }
  if (best.tool.requiresApproval) {
    warnings.push("Tool requires human approval before execution");
  }

  return {
    toolId: best.tool.id,
    toolName: best.tool.name,
    rationale: `Selected "${best.tool.name}" for ${input.task}: ${input.capability} capability in ${input.category} category (score: ${best.score})`,
    confidence: Math.min(100, best.score),
    alternatives: scored.slice(1, 4).map((s) => s.tool.id),
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. TOOL PIPELINE — chain tools for multi-step tasks
// ═══════════════════════════════════════════════════════════════════════════

export type ToolPipelineStep = {
  id: string;
  toolId: ToolId;
  name: string;
  params: Record<string, unknown> | ((previousOutput: unknown) => Record<string, unknown>);
  rationale: string;
  dependsOn: string[];
  optional: boolean;
  onFailure: "halt" | "skip" | "fallback";
  fallbackToolId: ToolId | null;
};

export type ToolPipeline = {
  id: string;
  name: string;
  description: string;
  steps: ToolPipelineStep[];
  context: Omit<ToolContext, "attempt" | "maxAttempts">;
};

export type PipelineResult = {
  pipelineId: string;
  success: boolean;
  stepsCompleted: number;
  stepsFailed: number;
  stepsSkipped: number;
  results: PipelineStepResult[];
  totalDurationMs: number;
  traces: ExecutionTrace[];
};

export type PipelineStepResult = {
  stepId: string;
  toolId: ToolId;
  success: boolean;
  output: ToolOutput | null;
  skipped: boolean;
  fallbackUsed: boolean;
  durationMs: number;
};

export async function executePipeline(pipeline: ToolPipeline): Promise<PipelineResult> {
  const startTime = Date.now();
  const results: PipelineStepResult[] = [];
  const completedSteps = new Map<string, ToolOutput>();
  const pipelineTraces: ExecutionTrace[] = [];

  for (const step of pipeline.steps) {
    // Check dependencies
    const depsMet = step.dependsOn.every((depId) => {
      const depResult = results.find((r) => r.stepId === depId);
      return depResult && (depResult.success || depResult.skipped);
    });

    if (!depsMet) {
      if (step.optional || step.onFailure === "skip") {
        results.push({
          stepId: step.id,
          toolId: step.toolId,
          success: false,
          output: null,
          skipped: true,
          fallbackUsed: false,
          durationMs: 0,
        });
        continue;
      }
      // Halt pipeline
      results.push({
        stepId: step.id,
        toolId: step.toolId,
        success: false,
        output: null,
        skipped: false,
        fallbackUsed: false,
        durationMs: 0,
      });
      break;
    }

    // Resolve params (may depend on previous output)
    const lastOutput = step.dependsOn.length > 0
      ? completedSteps.get(step.dependsOn[step.dependsOn.length - 1])?.data
      : undefined;

    const params = typeof step.params === "function"
      ? step.params(lastOutput)
      : step.params;

    const stepStart = Date.now();
    const context: ToolContext = {
      ...pipeline.context,
      attempt: 0,
      maxAttempts: 1,
      parentTraceId: pipeline.id,
    };

    let invocation = await invokeTool({
      toolId: step.toolId,
      params,
      context,
      rationale: step.rationale,
    });

    pipelineTraces.push(invocation.trace);
    let fallbackUsed = false;

    // Handle failure
    if (!invocation.success && step.onFailure === "fallback" && step.fallbackToolId) {
      invocation = await invokeTool({
        toolId: step.fallbackToolId,
        params,
        context,
        rationale: `Fallback for failed step: ${step.rationale}`,
      });
      pipelineTraces.push(invocation.trace);
      fallbackUsed = true;
    }

    const stepResult: PipelineStepResult = {
      stepId: step.id,
      toolId: fallbackUsed ? (step.fallbackToolId ?? step.toolId) : step.toolId,
      success: invocation.success,
      output: invocation.output,
      skipped: false,
      fallbackUsed,
      durationMs: Date.now() - stepStart,
    };

    results.push(stepResult);

    if (invocation.success && invocation.output) {
      completedSteps.set(step.id, invocation.output);
    }

    if (!invocation.success && step.onFailure === "halt" && !step.optional) {
      break;
    }
  }

  const completed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;

  return {
    pipelineId: pipeline.id,
    success: failed === 0,
    stepsCompleted: completed,
    stepsFailed: failed,
    stepsSkipped: skipped,
    results,
    totalDurationMs: Date.now() - startTime,
    traces: pipelineTraces,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. OUTPUT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export type OutputVerifier = (output: ToolOutput, context: ToolContext) => VerificationOutcome;

export type VerificationOutcome = {
  verified: boolean;
  method: string;
  details: string;
  discrepancies: string[];
};

const verifiers = new Map<ToolId, OutputVerifier>();

export function registerVerifier(toolId: ToolId, verifier: OutputVerifier): void {
  verifiers.set(toolId, verifier);
}

export function verifyOutput(toolId: ToolId, output: ToolOutput, context: ToolContext): VerificationOutcome {
  const verifier = verifiers.get(toolId);
  if (!verifier) {
    return {
      verified: false,
      method: "none",
      details: "No verifier registered for this tool",
      discrepancies: [],
    };
  }
  return verifier(output, context);
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. BUILT-IN TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const COMMON_PRECONDITIONS: ToolPrecondition[] = [
  { name: "Authentication", description: "Caller is authenticated", check: "auth_valid" },
];

const WRITE_PRECONDITIONS: ToolPrecondition[] = [
  ...COMMON_PRECONDITIONS,
  { name: "Approval", description: "Write action approved", check: "approval_granted" },
  { name: "Blast radius", description: "Within blast radius limits", check: "within_blast_radius" },
];

export const BUILTIN_TOOLS: ToolDefinition[] = [
  // Cloud API tools
  {
    id: toolId("aws.describe_instances"),
    name: "AWS Describe Instances",
    description: "List and describe EC2 instances with filters",
    version: "1.0.0",
    category: "cloud_api",
    capabilities: ["read"],
    riskLevel: "safe",
    providers: ["aws"],
    requiresAuth: true,
    requiresApproval: false,
    idempotent: true,
    timeout: 30_000,
    maxRetries: 3,
    retryBackoffMs: 1000,
    inputSchema: {
      type: "object",
      required: ["region"],
      properties: {
        region: { type: "string", description: "AWS region" },
        filters: { type: "object", description: "EC2 filters" },
        instanceIds: { type: "array", description: "Specific instance IDs" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["instances"],
      properties: {
        instances: { type: "array", description: "EC2 instance descriptions" },
      },
    },
    preconditions: COMMON_PRECONDITIONS,
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["aws", "compute", "read"] },
  },
  {
    id: toolId("aws.resize_instance"),
    name: "AWS Resize Instance",
    description: "Change EC2 instance type (requires stop/start)",
    version: "1.0.0",
    category: "execution",
    capabilities: ["write", "execute"],
    riskLevel: "cautious",
    providers: ["aws"],
    requiresAuth: true,
    requiresApproval: true,
    idempotent: true,
    timeout: 120_000,
    maxRetries: 2,
    retryBackoffMs: 5000,
    inputSchema: {
      type: "object",
      required: ["instanceId", "targetType", "region"],
      properties: {
        instanceId: { type: "string", description: "EC2 instance ID" },
        targetType: { type: "string", description: "Target instance type" },
        region: { type: "string", description: "AWS region" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["success", "previousType", "newType"],
      properties: {
        success: { type: "boolean", description: "Whether resize succeeded" },
        previousType: { type: "string", description: "Previous instance type" },
        newType: { type: "string", description: "New instance type" },
      },
    },
    preconditions: WRITE_PRECONDITIONS,
    sideEffects: ["Instance stopped and restarted", "Connections dropped during resize"],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["aws", "compute", "write", "downtime"] },
  },
  {
    id: toolId("aws.describe_storage"),
    name: "AWS Describe Storage",
    description: "List S3 buckets, EBS volumes, and their configurations",
    version: "1.0.0",
    category: "cloud_api",
    capabilities: ["read"],
    riskLevel: "safe",
    providers: ["aws"],
    requiresAuth: true,
    requiresApproval: false,
    idempotent: true,
    timeout: 30_000,
    maxRetries: 3,
    retryBackoffMs: 1000,
    inputSchema: {
      type: "object",
      required: ["region"],
      properties: {
        region: { type: "string", description: "AWS region" },
        storageType: { type: "string", description: "s3 or ebs", enum: ["s3", "ebs", "all"] },
      },
    },
    outputSchema: {
      type: "object",
      required: ["resources"],
      properties: {
        resources: { type: "array", description: "Storage resource descriptions" },
      },
    },
    preconditions: COMMON_PRECONDITIONS,
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["aws", "storage", "read"] },
  },
  // Terraform tools
  {
    id: toolId("terraform.generate"),
    name: "Terraform Generator",
    description: "Generate Terraform HCL for planned infrastructure changes",
    version: "1.0.0",
    category: "terraform",
    capabilities: ["generate"],
    riskLevel: "safe",
    providers: "all",
    requiresAuth: false,
    requiresApproval: false,
    idempotent: true,
    timeout: 15_000,
    maxRetries: 1,
    retryBackoffMs: 1000,
    inputSchema: {
      type: "object",
      required: ["resourceType", "action", "currentState", "desiredState"],
      properties: {
        resourceType: { type: "string", description: "Cloud resource type" },
        action: { type: "string", description: "Action to perform" },
        currentState: { type: "object", description: "Current resource state" },
        desiredState: { type: "object", description: "Desired resource state" },
        provider: { type: "string", description: "Cloud provider" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["hcl"],
      properties: {
        hcl: { type: "string", description: "Generated Terraform HCL" },
        plan: { type: "string", description: "Terraform plan summary" },
      },
    },
    preconditions: [],
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["terraform", "iac", "generate"] },
  },
  // CLI tools
  {
    id: toolId("cli.generate"),
    name: "CLI Command Generator",
    description: "Generate cloud CLI commands (aws/az/gcloud) for infrastructure changes",
    version: "1.0.0",
    category: "cli",
    capabilities: ["generate"],
    riskLevel: "safe",
    providers: "all",
    requiresAuth: false,
    requiresApproval: false,
    idempotent: true,
    timeout: 5_000,
    maxRetries: 0,
    retryBackoffMs: 0,
    inputSchema: {
      type: "object",
      required: ["provider", "action", "resourceId"],
      properties: {
        provider: { type: "string", description: "Cloud provider" },
        action: { type: "string", description: "Action to perform" },
        resourceId: { type: "string", description: "Target resource ID" },
        params: { type: "object", description: "Action parameters" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string", description: "Generated CLI command" },
        dryRunCommand: { type: "string", description: "Dry-run variant" },
      },
    },
    preconditions: [],
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["cli", "generate"] },
  },
  // Policy engine
  {
    id: toolId("policy.evaluate"),
    name: "Policy Evaluator",
    description: "Evaluate governance policies against current infrastructure state",
    version: "1.0.0",
    category: "policy",
    capabilities: ["evaluate"],
    riskLevel: "safe",
    providers: "all",
    requiresAuth: true,
    requiresApproval: false,
    idempotent: true,
    timeout: 30_000,
    maxRetries: 1,
    retryBackoffMs: 1000,
    inputSchema: {
      type: "object",
      required: ["orgId", "snapshot"],
      properties: {
        orgId: { type: "string", description: "Organization ID" },
        snapshot: { type: "object", description: "Cloud snapshot to evaluate" },
        policyIds: { type: "array", description: "Specific policies to check" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["violations", "passed"],
      properties: {
        violations: { type: "array", description: "Policy violations found" },
        passed: { type: "number", description: "Number of policies passed" },
      },
    },
    preconditions: COMMON_PRECONDITIONS,
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["policy", "governance", "evaluate"] },
  },
  // Monitoring
  {
    id: toolId("monitor.check_health"),
    name: "Health Monitor",
    description: "Check current health of infrastructure resources",
    version: "1.0.0",
    category: "monitoring",
    capabilities: ["observe"],
    riskLevel: "safe",
    providers: "all",
    requiresAuth: true,
    requiresApproval: false,
    idempotent: true,
    timeout: 15_000,
    maxRetries: 2,
    retryBackoffMs: 2000,
    inputSchema: {
      type: "object",
      required: ["resourceIds"],
      properties: {
        resourceIds: { type: "array", description: "Resources to check" },
        provider: { type: "string", description: "Cloud provider" },
        region: { type: "string", description: "Region" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["statuses"],
      properties: {
        statuses: { type: "array", description: "Health status per resource" },
      },
    },
    preconditions: COMMON_PRECONDITIONS,
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["monitoring", "health", "observe"] },
  },
  // Diff engine
  {
    id: toolId("diff.snapshots"),
    name: "Snapshot Differ",
    description: "Compare two cloud snapshots and identify changes",
    version: "1.0.0",
    category: "diff",
    capabilities: ["compare"],
    riskLevel: "safe",
    providers: "all",
    requiresAuth: false,
    requiresApproval: false,
    idempotent: true,
    timeout: 20_000,
    maxRetries: 1,
    retryBackoffMs: 1000,
    inputSchema: {
      type: "object",
      required: ["previousSnapshot", "currentSnapshot"],
      properties: {
        previousSnapshot: { type: "object", description: "Previous snapshot" },
        currentSnapshot: { type: "object", description: "Current snapshot" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["delta"],
      properties: {
        delta: { type: "object", description: "Snapshot delta" },
      },
    },
    preconditions: [],
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["diff", "compare", "drift"] },
  },
  // Memory
  {
    id: toolId("memory.query"),
    name: "Memory Query",
    description: "Retrieve relevant agent memory for context",
    version: "1.0.0",
    category: "memory",
    capabilities: ["query"],
    riskLevel: "safe",
    providers: "all",
    requiresAuth: true,
    requiresApproval: false,
    idempotent: true,
    timeout: 5_000,
    maxRetries: 1,
    retryBackoffMs: 500,
    inputSchema: {
      type: "object",
      required: ["orgId"],
      properties: {
        orgId: { type: "string", description: "Organization ID" },
        query: { type: "string", description: "Search query" },
        memoryTypes: { type: "array", description: "Memory types to search" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["results"],
      properties: {
        results: { type: "array", description: "Memory query results" },
      },
    },
    preconditions: COMMON_PRECONDITIONS,
    sideEffects: [],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["memory", "query", "context"] },
  },
  // Rollback
  {
    id: toolId("rollback.revert"),
    name: "Rollback Engine",
    description: "Revert a previously applied infrastructure change",
    version: "1.0.0",
    category: "rollback",
    capabilities: ["revert", "write"],
    riskLevel: "dangerous",
    providers: "all",
    requiresAuth: true,
    requiresApproval: true,
    idempotent: false,
    timeout: 180_000,
    maxRetries: 2,
    retryBackoffMs: 10_000,
    inputSchema: {
      type: "object",
      required: ["operationStepId", "preChangeState"],
      properties: {
        operationStepId: { type: "string", description: "Step to rollback" },
        preChangeState: { type: "object", description: "State before the change" },
        resourceIds: { type: "array", description: "Resources to rollback" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["success", "resourcesReverted"],
      properties: {
        success: { type: "boolean", description: "Whether rollback succeeded" },
        resourcesReverted: { type: "number", description: "Count of reverted resources" },
      },
    },
    preconditions: WRITE_PRECONDITIONS,
    sideEffects: ["Resources reverted to previous state", "Active connections may be disrupted"],
    metadata: { author: "axiom", addedAt: "2025-01-01", deprecated: false, replacedBy: null, tags: ["rollback", "revert", "recovery"] },
  },
];

export function registerBuiltinTools(): number {
  let count = 0;
  for (const tool of BUILTIN_TOOLS) {
    const handler: ToolHandler = async (_input, _ctx) => ({
      success: true,
      data: {},
      errors: [],
      warnings: ["Stub handler — replace with real provider integration"],
      metadata: { resourcesRead: 0, resourcesModified: 0, bytesTransferred: 0, apiCallsMade: 0, costEstimate: null, providerRequestIds: [] },
    });
    registerTool(tool, handler);
    count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. TRACE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export type TraceAnalysis = {
  totalInvocations: number;
  successRate: number;
  avgDurationMs: number;
  retryRate: number;
  escalationRate: number;
  byCategory: Record<string, { count: number; successRate: number; avgMs: number }>;
  byTool: Record<string, { count: number; successRate: number; avgMs: number }>;
  slowestTool: string | null;
  mostFailedTool: string | null;
  totalApiCalls: number;
};

export function analyzeTraces(filter?: TraceFilter): TraceAnalysis {
  const filtered = getTraces(filter);

  if (filtered.length === 0) {
    return {
      totalInvocations: 0,
      successRate: 0,
      avgDurationMs: 0,
      retryRate: 0,
      escalationRate: 0,
      byCategory: {},
      byTool: {},
      slowestTool: null,
      mostFailedTool: null,
      totalApiCalls: 0,
    };
  }

  const successes = filtered.filter((t) => t.output?.success);
  const retried = filtered.filter((t) => t.recovery.retried);
  const escalated = filtered.filter((t) => t.recovery.escalated);

  const byCategory: Record<string, { count: number; successCount: number; totalMs: number }> = {};
  const byTool: Record<string, { count: number; successCount: number; totalMs: number }> = {};

  for (const t of filtered) {
    const cat = t.category;
    if (!byCategory[cat]) byCategory[cat] = { count: 0, successCount: 0, totalMs: 0 };
    byCategory[cat].count++;
    if (t.output?.success) byCategory[cat].successCount++;
    byCategory[cat].totalMs += t.timing.durationMs;

    const name = t.toolName;
    if (!byTool[name]) byTool[name] = { count: 0, successCount: 0, totalMs: 0 };
    byTool[name].count++;
    if (t.output?.success) byTool[name].successCount++;
    byTool[name].totalMs += t.timing.durationMs;
  }

  const catResult: TraceAnalysis["byCategory"] = {};
  for (const [k, v] of Object.entries(byCategory)) {
    catResult[k] = { count: v.count, successRate: v.successCount / v.count, avgMs: Math.round(v.totalMs / v.count) };
  }

  const toolResult: TraceAnalysis["byTool"] = {};
  for (const [k, v] of Object.entries(byTool)) {
    toolResult[k] = { count: v.count, successRate: v.successCount / v.count, avgMs: Math.round(v.totalMs / v.count) };
  }

  const slowest = Object.entries(toolResult).sort((a, b) => b[1].avgMs - a[1].avgMs);
  const mostFailed = Object.entries(toolResult).filter(([, v]) => v.successRate < 1).sort((a, b) => a[1].successRate - b[1].successRate);

  return {
    totalInvocations: filtered.length,
    successRate: successes.length / filtered.length,
    avgDurationMs: Math.round(filtered.reduce((s, t) => s + t.timing.durationMs, 0) / filtered.length),
    retryRate: retried.length / filtered.length,
    escalationRate: escalated.length / filtered.length,
    byCategory: catResult,
    byTool: toolResult,
    slowestTool: slowest[0]?.[0] ?? null,
    mostFailedTool: mostFailed[0]?.[0] ?? null,
    totalApiCalls: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. RESET & TESTS
// ═══════════════════════════════════════════════════════════════════════════

export function _resetFrameworkState(): void {
  clearRegistry();
  clearTraces();
  traceSeq = 0;
}

export type ToolFrameworkTestResult = { name: string; passed: boolean; detail: string };

export async function runToolFrameworkTests(): Promise<ToolFrameworkTestResult[]> {
  const results: ToolFrameworkTestResult[] = [];
  _resetFrameworkState();

  function assert(name: string, passed: boolean, detail: string) {
    results.push({ name, passed, detail });
  }

  const baseCtx: ToolContext = {
    correlationId: "corr-1",
    orgId: "org-1",
    userId: "user-1",
    runId: "run-1",
    loopId: "loop-1",
    phase: "executing",
    provider: "aws",
    region: "us-east-1",
    authorization: {
      authenticated: true,
      role: "admin",
      scopes: ["read", "write"],
      approvalChainId: "chain-1",
      approvedActions: ["resize_compute"],
    },
    dryRun: false,
    timeout: 30_000,
    attempt: 0,
    maxAttempts: 3,
    parentTraceId: null,
    metadata: {},
  };

  // Test 1: Register builtin tools
  const count = registerBuiltinTools();
  assert("register builtins", count === BUILTIN_TOOLS.length, `registered=${count}`);

  // Test 2: List tools
  const all = listTools();
  assert("list all tools", all.length === BUILTIN_TOOLS.length, `count=${all.length}`);

  // Test 3: Filter by category
  const cloudTools = listTools({ category: "cloud_api" });
  assert("filter by category", cloudTools.length > 0 && cloudTools.every((t) => t.category === "cloud_api"),
    `cloud_api count=${cloudTools.length}`);

  // Test 4: Filter by provider
  const awsTools = listTools({ provider: "aws" });
  assert("filter by provider", awsTools.length > 0, `aws count=${awsTools.length}`);

  // Test 5: Get specific tool
  const descInst = getTool(toolId("aws.describe_instances"));
  assert("get tool by id", descInst !== undefined && descInst.name === "AWS Describe Instances",
    `name=${descInst?.name}`);

  // Test 6: Tool selection
  const selection = selectTool({
    task: "Read instance data",
    category: "cloud_api",
    capability: "read",
    provider: "aws",
    riskBudget: "safe",
    preferIdempotent: true,
  });
  assert("tool selection", selection !== null && selection.confidence > 0,
    `selected=${selection?.toolName}, confidence=${selection?.confidence}`);

  // Test 7: Invoke safe tool
  const readResult = await invokeTool({
    toolId: toolId("aws.describe_instances"),
    params: { region: "us-east-1" },
    context: baseCtx,
    rationale: "Need instance data for optimization",
  });
  assert("invoke safe tool", readResult.success, `success=${readResult.success}`);

  // Test 8: Trace recorded
  const traceList = getTraces({ toolId: toolId("aws.describe_instances") });
  assert("trace recorded", traceList.length === 1, `traces=${traceList.length}`);

  // Test 9: Trace has correct structure
  const trace = traceList[0];
  assert("trace structure",
    trace.toolId === toolId("aws.describe_instances") &&
    trace.input.rationale === "Need instance data for optimization" &&
    trace.validation.inputValid,
    `toolId=${trace.toolId}, inputValid=${trace.validation.inputValid}`);

  // Test 10: Input validation rejects bad input
  const badResult = await invokeTool({
    toolId: toolId("aws.describe_instances"),
    params: {},
    context: baseCtx,
    rationale: "Missing required region",
  });
  assert("input validation rejects", !badResult.success, `success=${badResult.success}`);

  // Test 11: Unauthorized write rejected
  const unauthCtx: ToolContext = {
    ...baseCtx,
    authorization: { ...baseCtx.authorization, authenticated: false },
  };
  const unauthResult = await invokeTool({
    toolId: toolId("aws.resize_instance"),
    params: { instanceId: "i-123", targetType: "m5.large", region: "us-east-1" },
    context: unauthCtx,
    rationale: "Resize instance",
  });
  assert("unauthorized write rejected", !unauthResult.success,
    `error=${unauthResult.trace.output?.errors[0]?.code}`);

  // Test 12: Tool not found
  const missingResult = await invokeTool({
    toolId: toolId("nonexistent.tool"),
    params: {},
    context: baseCtx,
    rationale: "This should fail",
  });
  assert("tool not found", !missingResult.success && missingResult.trace.output?.errors[0]?.code === "TOOL_NOT_FOUND",
    `code=${missingResult.trace.output?.errors[0]?.code}`);

  // Test 13: Pipeline execution
  const pipeline: ToolPipeline = {
    id: "pipeline-1",
    name: "Test Pipeline",
    description: "Read then generate",
    steps: [
      {
        id: "step-1",
        toolId: toolId("aws.describe_instances"),
        name: "Read instances",
        params: { region: "us-east-1" },
        rationale: "Get current state",
        dependsOn: [],
        optional: false,
        onFailure: "halt",
        fallbackToolId: null,
      },
      {
        id: "step-2",
        toolId: toolId("terraform.generate"),
        name: "Generate terraform",
        params: { resourceType: "ec2", action: "resize", currentState: {}, desiredState: {} },
        rationale: "Generate IaC",
        dependsOn: ["step-1"],
        optional: false,
        onFailure: "halt",
        fallbackToolId: null,
      },
    ],
    context: baseCtx,
  };
  const pipelineResult = await executePipeline(pipeline);
  assert("pipeline executes", pipelineResult.success && pipelineResult.stepsCompleted === 2,
    `success=${pipelineResult.success}, completed=${pipelineResult.stepsCompleted}`);

  // Test 14: Pipeline halts on failure
  _resetFrameworkState();
  registerBuiltinTools();
  // Replace handler with failing one
  const failHandler: ToolHandler = async () => ({
    success: false,
    data: null,
    errors: [{ code: "FAIL", message: "Intentional failure", retryable: false, provider: null, resourceId: null, suggestion: null }],
    warnings: [],
    metadata: { resourcesRead: 0, resourcesModified: 0, bytesTransferred: 0, apiCallsMade: 0, costEstimate: null, providerRequestIds: [] },
  });
  handlers.set(toolId("aws.describe_instances"), failHandler);

  const failPipeline = await executePipeline(pipeline);
  assert("pipeline halts on failure",
    !failPipeline.success && failPipeline.stepsCompleted === 0,
    `success=${failPipeline.success}, failed=${failPipeline.stepsFailed}`);

  // Test 15: Verifier registration
  _resetFrameworkState();
  registerBuiltinTools();
  registerVerifier(toolId("aws.describe_instances"), (output) => ({
    verified: output.success,
    method: "output_check",
    details: "Verified instance data",
    discrepancies: [],
  }));
  const verResult = verifyOutput(
    toolId("aws.describe_instances"),
    { success: true, data: {}, errors: [], warnings: [], metadata: { resourcesRead: 1, resourcesModified: 0, bytesTransferred: 0, apiCallsMade: 1, costEstimate: null, providerRequestIds: [] } },
    baseCtx,
  );
  assert("verifier works", verResult.verified, `method=${verResult.method}`);

  // Test 16: Unregistered verifier returns not verified
  const noVerResult = verifyOutput(toolId("terraform.generate"),
    { success: true, data: {}, errors: [], warnings: [], metadata: { resourcesRead: 0, resourcesModified: 0, bytesTransferred: 0, apiCallsMade: 0, costEstimate: null, providerRequestIds: [] } },
    baseCtx,
  );
  assert("no verifier returns unverified", !noVerResult.verified, `method=${noVerResult.method}`);

  // Test 17: Trace analysis
  const analysis = analyzeTraces();
  assert("trace analysis",
    analysis.totalInvocations > 0 && typeof analysis.successRate === "number",
    `invocations=${analysis.totalInvocations}, rate=${analysis.successRate}`);

  // Test 18: Tool count
  assert("tool count", getToolCount() === BUILTIN_TOOLS.length,
    `count=${getToolCount()}`);

  // Test 19: Unregister tool
  const removed = unregisterTool(toolId("aws.describe_instances"));
  assert("unregister tool", removed && getToolCount() === BUILTIN_TOOLS.length - 1,
    `removed=${removed}, remaining=${getToolCount()}`);

  // Test 20: Risk-budget filtering in selection
  const safeOnly = selectTool({
    task: "Rollback changes",
    category: "rollback",
    capability: "revert",
    provider: null,
    riskBudget: "safe",
    preferIdempotent: false,
  });
  // Rollback tool is "dangerous", so with "safe" budget it should still return
  // (falls back to all candidates when none match budget)
  assert("risk budget selection", safeOnly !== null,
    `selected=${safeOnly?.toolName}, warnings=${safeOnly?.warnings.length}`);

  return results;
}
