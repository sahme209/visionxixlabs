import { redactSecrets } from "./deploymentOperations";

export type AdapterMode = "mock" | "sandbox" | "read" | "write";
export type AdapterSystem =
  | "github" | "servicenow" | "work_item" | "teams" | "slack" | "email"
  | "oracle" | "airflow" | "azure" | "kubernetes" | "helm" | "registry"
  | "vault" | "pagerduty" | "confluence";

export type DeploymentErrorCategory =
  | "access" | "approval" | "input" | "scheduling" | "change_management"
  | "source_control" | "build" | "registry" | "deployment" | "database"
  | "kubernetes" | "helm" | "airflow" | "validation" | "networking"
  | "authentication" | "dependency" | "manual_step" | "unknown";

export interface AdapterStatus {
  system: AdapterSystem;
  mode: AdapterMode;
  healthy: boolean;
  authenticated: boolean;
  scopes: string[];
  secretReference?: string;
  checkedAtUtc: string;
}

export interface AdapterRequest<TPayload = unknown> {
  tenantId: string;
  correlationId: string;
  actorId: string;
  payload: TPayload;
  humanConfirmationId?: string;
  /** Durable identity supplied for consequential operations. */
  operationId?: string;
  /** Provider adapters must forward this when the provider supports idempotency. */
  idempotencyKey?: string;
}

export interface AdapterResult<TData = unknown> {
  ok: boolean;
  mode: AdapterMode;
  data?: TData;
  runUrl?: string;
  error?: {
    category: DeploymentErrorCategory;
    message: string;
    retryable: boolean;
  };
  audit: {
    tenantId: string;
    correlationId: string;
    actorId: string;
    action: string;
    occurredAtUtc: string;
  };
}

export interface DeploymentAdapter<TPayload = unknown, TData = unknown> {
  readonly system: AdapterSystem;
  readonly mode: AdapterMode;
  healthCheck(): Promise<AdapterStatus>;
  execute(request: AdapterRequest<TPayload>): Promise<AdapterResult<TData>>;
}

export interface MockScenario<TData> {
  outcome: "success" | "permission_denied" | "approval_pending" | "input_error" | "failure";
  data?: TData;
  message?: string;
}

export class SecureMockAdapter<TPayload, TData> implements DeploymentAdapter<TPayload, TData> {
  constructor(
    readonly system: AdapterSystem,
    readonly mode: AdapterMode = "mock",
    private readonly scenario: MockScenario<TData> = { outcome: "success" },
  ) {}

  async healthCheck(): Promise<AdapterStatus> {
    return {
      system: this.system,
      mode: this.mode,
      healthy: true,
      authenticated: this.mode === "mock" || this.mode === "sandbox",
      scopes: this.mode === "write" ? ["read", "write"] : ["read"],
      secretReference: this.mode === "mock" ? undefined : `secretref://${this.system}/credential`,
      checkedAtUtc: new Date().toISOString(),
    };
  }

  async execute(request: AdapterRequest<TPayload>): Promise<AdapterResult<TData>> {
    if (!request.tenantId || !request.correlationId || !request.actorId) {
      return this.result(request, false, undefined, "input", "Tenant, correlation, and actor are required.", false);
    }
    if (this.mode === "write" && !request.humanConfirmationId) {
      return this.result(request, false, undefined, "approval", "Explicit authorized human confirmation is required for write mode.", false);
    }
    if (this.scenario.outcome === "success") return this.result(request, true, this.scenario.data);
    const mapping: Record<Exclude<MockScenario<TData>["outcome"], "success">, [DeploymentErrorCategory, boolean]> = {
      permission_denied: ["access", false],
      approval_pending: ["approval", true],
      input_error: ["input", false],
      failure: ["unknown", true],
    };
    const [category, retryable] = mapping[this.scenario.outcome];
    return this.result(request, false, undefined, category, this.scenario.message ?? "Mock adapter failure.", retryable);
  }

  private result(
    request: AdapterRequest<TPayload>,
    ok: boolean,
    data?: TData,
    category?: DeploymentErrorCategory,
    message?: string,
    retryable = false,
  ): AdapterResult<TData> {
    return {
      ok,
      mode: this.mode,
      data,
      error: category ? { category, message: redactSecrets(message ?? "Adapter error."), retryable } : undefined,
      audit: {
        tenantId: request.tenantId,
        correlationId: request.correlationId,
        actorId: request.actorId,
        action: `${this.system}.execute`,
        occurredAtUtc: new Date().toISOString(),
      },
    };
  }
}

export function classifyDeploymentError(messages: string[]): {
  category: DeploymentErrorCategory;
  blocking: boolean;
  reason: string;
} {
  const joined = messages.join("\n").toLowerCase();
  if (/does not belong to assigned workgroup|run workflow.*not visible|merge button.*not visible|permission denied|forbidden/.test(joined)) {
    return { category: "access", blocking: true, reason: "A repository- or workgroup-specific capability is missing." };
  }
  if (/milestone.*target date|outside.*window|planned start|planned finish/.test(joined)) {
    return { category: "scheduling", blocking: true, reason: "Deployment timing or milestone configuration is invalid." };
  }
  if (/servicenow|change ticket|assignment group|assigned-to/.test(joined)) {
    return { category: "change_management", blocking: true, reason: "Change-management processing failed." };
  }
  if (/node.*deprecat|deprecated node/.test(joined)) {
    return { category: "build", blocking: false, reason: "Runtime deprecation warning requires review but is not the root failure." };
  }
  if (/helm.*conflict|force.conflict|resource drift/.test(joined)) {
    return { category: "helm", blocking: true, reason: "Helm and running Kubernetes values differ; explicit review is required." };
  }
  if (/table.*not dropped|missing table drop/.test(joined)) {
    return { category: "database", blocking: true, reason: "All affected tables must be confirmed before script execution." };
  }
  if (/sonarqube|quality gate/.test(joined)) {
    return { category: "validation", blocking: true, reason: "Severity is policy-driven and cannot be globally ignored." };
  }
  return { category: "unknown", blocking: true, reason: "Unknown failures block automatic completion until reviewed." };
}

export const requiredAdapterSystems: readonly AdapterSystem[] = [
  "github", "servicenow", "work_item", "teams", "slack", "email", "oracle",
  "airflow", "azure", "kubernetes", "helm", "registry", "vault", "pagerduty", "confluence",
];
