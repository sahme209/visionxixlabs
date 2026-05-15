/**
 * Desktop app's web client.
 *
 * Wraps the typed REST endpoints the web platform exposes. Honest by
 * design — when the desktop runtime isn't connected to a workspace, the
 * client returns a typed `disconnected` outcome rather than fabricating
 * data. UI surfaces show preview state accordingly.
 */

const DEFAULT_API_BASE = "https://visionxixlabs.com";

export type DesktopConnectionState = "connecting" | "connected" | "disconnected" | "auth_required";

export interface DesktopClientConfig {
  apiBase: string;
  /** Bearer-style session token / API key. Optional during preview. */
  sessionToken?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Typed result shapes (subset of the server API surface — keeps the
// desktop bundle lean by only typing fields it renders).
// ---------------------------------------------------------------------------

export interface CommandCenterStateLite {
  features: {
    awsScanMode: "live" | "preview" | "disabled";
    githubSyncMode: "live" | "preview" | "disabled";
    desktopMode: "live" | "preview" | "disabled";
    copilotEnabled: boolean;
    oauth: { google: boolean; github: boolean };
  };
  user: {
    isAuthenticated: boolean;
    email?: string;
    displayName?: string;
    workspaceLabel?: string;
  };
  headline: string;
}

export interface ControlPlaneStateLite {
  tenantId?: string;
  generatedAt: string;
  sourceMode: "live" | "preview" | "planned" | "blocked" | "empty";
  providers: {
    provider: "aws" | "azure" | "gcp";
    mode: "live" | "preview" | "disabled";
    connectionStatus: string;
    validationStatus: string;
    scanStatus: string;
    resourceCounts: Record<string, number>;
    topFindings: { ruleCode: string; risk: string; resourceRef: string }[];
    missingCapabilities: string[];
    sourceMode: string;
    confidence: number;
    nextAction?: { label: string; href?: string };
  }[];
  cloudInventory: {
    totalResources: number;
    byProvider: Record<string, number>;
  };
  securityPosture:    PostureLite;
  costPosture:        PostureLite;
  reliabilityPosture: PostureLite;
  releaseOpsPosture:  PostureLite;
  desktopPosture:     PostureLite;
  remediationPosture: PostureLite;
  simulationPosture:  PostureLite;
  approvalPosture:    PostureLite;
  validationPosture:  PostureLite;
  nextBestActions: {
    id: string;
    title: string;
    description: string;
    category: string;
    priority: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    canRunNow: boolean;
    approvalRequired: boolean;
    route?: string;
  }[];
  blockers: { code: string; detail: string }[];
  risks: { code: string; detail: string }[];
}

export interface PostureLite {
  score: number;
  status: "healthy" | "warning" | "degraded" | "preview" | "blocked" | "unknown";
  summary: string;
  criticalItems: number;
  warnings: number;
  sourceMode: string;
  nextAction?: { label: string; href?: string };
}

export interface RemediationCandidateLite {
  id: string;
  title: string;
  description: string;
  provider: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  category: string;
  impactSummary: string;
  policyDecision: string;
  approvalRequirement: string;
  desktopReviewEligibility: string;
  status: string;
  sourceMode: string;
}

export interface RemediationPipelineLite {
  generatedAt: string;
  bundles: {
    candidate: RemediationCandidateLite;
    readiness: { decision: string; reason: string; safeNextAction?: { label: string; href?: string } };
    terraform: { fileName: string; hcl: string; manualReviewRequired: boolean; explanation: string };
    cli: { cli: string; command: string; manualReviewRequired: boolean; explanation: string };
    rollback: { rollbackAvailable: boolean; rollbackComplexity: string; rollbackSteps: { ordinal: number; detail: string }[] };
    verification: { manualOrAutomated: string; checks: { ordinal: number; title: string; execution: string }[] };
    finalStatus: string;
  }[];
  summary: {
    total: number;
    approvalGated: number;
    desktopEligible: number;
    blocked: number;
    byRisk: { low: number; medium: number; high: number; critical: number };
  };
}

export interface SimulationResultLite {
  id: string;
  changeSetId: string;
  status: "simulated" | "blocked" | "unsafe" | "incomplete" | "preview_only";
  summary: string;
  delta: { security: string; risk: string };
  impact: { directlyAffected: { resourceId: string; impactLevel: string }[]; indirectlyAffected: { resourceId: string }[]; overallImpact: string };
  rollbackFeasibility: string;
  blockers: { code: string; reason: string }[];
  approvalsRequired: { actionId: string; reason: string }[];
  safeNextAction: { label: string; href?: string };
  confidence: number;
}

export interface SimulationsBatchLite {
  generatedAt: string;
  twinId: string;
  results: SimulationResultLite[];
  summary: { total: number; simulated: number; preview_only: number; blocked: number; unsafe: number };
}

export interface OrchestrationLite {
  id: string;
  title: string;
  description?: string;
  provider: string;
  stage: string;
  status: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  sourceMode: string;
  safeNextAction?: { label: string; href?: string };
}

export interface OrchestrationListLite {
  generatedAt: string;
  orchestrations: OrchestrationLite[];
  approvals: {
    id: string;
    sourceType: string;
    sourceId: string;
    provider: string;
    riskLevel: string;
    changeSummary: string;
    status: string;
    expiresAt: string;
    approverRole: string;
  }[];
  activeLocks: { id: string; kind: string; resourceRef: string; expiresAt: string }[];
  summary: { total: number; approvalRequested: number; blocked: number; desktopReviewReady: number };
}

export interface SecurityScanLite {
  generatedAt: string;
  results: {
    id: string;
    title: string;
    description: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    category: string;
    scope: string;
    provider?: string;
    status: "pass" | "fail" | "warn" | "unknown" | "preview";
    evidence: string[];
    remediation?: string;
    source: "live" | "preview";
  }[];
  summary: { total: number; pass: number; fail: number; warn: number; unknown: number; preview: number; score: number };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class DesktopClient {
  config: DesktopClientConfig;

  constructor(config?: Partial<DesktopClientConfig>) {
    this.config = {
      apiBase: config?.apiBase ?? DEFAULT_API_BASE,
      sessionToken: config?.sessionToken,
    };
  }

  setSession(token: string | undefined) {
    this.config = { ...this.config, sessionToken: token };
  }

  setApiBase(base: string) {
    this.config = { ...this.config, apiBase: base };
  }

  /** True when the last API call fell back to mock data (cross-origin or 4xx). */
  isPreviewMode = false;

  // ── Command center / control plane ────────────────────────────────
  commandCenterState():  Promise<ApiResult<CommandCenterStateLite>>   { return this.get("/api/command-center"); }

  async controlPlaneState(): Promise<ApiResult<ControlPlaneStateLite>> {
    const res = await this.get<ControlPlaneStateLite>("/api/control-plane/state");
    if (res.ok) { this.isPreviewMode = false; return res; }
    this.isPreviewMode = true;
    const { MOCK_CONTROL_PLANE } = await import("./mockData");
    return { ok: true, data: MOCK_CONTROL_PLANE };
  }
  controlPlaneActions(): Promise<ApiResult<{ nextBestActions: ControlPlaneStateLite["nextBestActions"] }>> { return this.get("/api/control-plane/next-actions"); }
  controlPlaneRefresh(): Promise<ApiResult<{ state: ControlPlaneStateLite }>> { return this.post("/api/control-plane/refresh", {}); }

  // ── Cloud connectors ──────────────────────────────────────────────
  awsValidate(input: { roleArn: string; externalId: string; region: string; requestLive?: boolean }): Promise<ApiResult<unknown>> {
    return this.post("/api/aws/validate", input);
  }
  awsScan(input: { roleArn: string; externalId: string; region: string; requestLive?: boolean }): Promise<ApiResult<unknown>> {
    return this.post("/api/aws/scan", input);
  }
  azureValidate(input: { tenantId: string; clientId: string; clientSecret: string; subscriptionId: string }): Promise<ApiResult<unknown>> {
    return this.post("/api/azure/validate", input);
  }
  gcpValidate(input: { projectId: string; serviceAccountJson: string }): Promise<ApiResult<unknown>> {
    return this.post("/api/gcp/validate", input);
  }

  // ── Security scanner ──────────────────────────────────────────────
  async securityScan(): Promise<ApiResult<SecurityScanLite>> {
    const res = await this.post<SecurityScanLite>("/api/security-scan", {});
    if (res.ok) { this.isPreviewMode = false; return res; }
    this.isPreviewMode = true;
    const { MOCK_SECURITY } = await import("./mockData");
    return { ok: true, data: MOCK_SECURITY };
  }

  // ── Remediation ───────────────────────────────────────────────────
  async remediationPlan(): Promise<ApiResult<RemediationPipelineLite>> {
    const res = await this.post<RemediationPipelineLite>("/api/remediation/plan", {});
    if (res.ok) { this.isPreviewMode = false; return res; }
    this.isPreviewMode = true;
    const { MOCK_REMEDIATION } = await import("./mockData");
    return { ok: true, data: MOCK_REMEDIATION };
  }
  remediationCandidates(): Promise<ApiResult<{ candidates: RemediationCandidateLite[] }>> { return this.post("/api/remediation/candidates", {}); }

  // ── Simulation ────────────────────────────────────────────────────
  async simulationsBatch(): Promise<ApiResult<SimulationsBatchLite>> {
    const res = await this.post<SimulationsBatchLite>("/api/simulations/create", {});
    if (res.ok) { this.isPreviewMode = false; return res; }
    this.isPreviewMode = true;
    const { MOCK_SIMULATIONS } = await import("./mockData");
    return { ok: true, data: MOCK_SIMULATIONS };
  }
  simulationFromRemediation(candidateId: string): Promise<ApiResult<{ result: SimulationResultLite }>> {
    return this.post("/api/simulations/from-remediation", { candidateId });
  }

  // ── Orchestration ─────────────────────────────────────────────────
  async orchestration(): Promise<ApiResult<OrchestrationListLite>> {
    const res = await this.get<OrchestrationListLite>("/api/orchestration");
    if (res.ok) { this.isPreviewMode = false; return res; }
    this.isPreviewMode = true;
    const { MOCK_ORCHESTRATION } = await import("./mockData");
    return { ok: true, data: MOCK_ORCHESTRATION };
  }
  decideApproval(id: string, decision: "approved" | "rejected", reason?: string): Promise<ApiResult<unknown>> {
    return this.post(`/api/orchestration/approvals/${encodeURIComponent(id)}/decide`, { decision, reason });
  }

  // ── Release manifest ──────────────────────────────────────────────
  releaseManifest(): Promise<ApiResult<{ source: string; tag?: string; assets: Record<string, unknown> }>> {
    return this.get("/api/desktop/release-manifest");
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private async get<T>(path: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        headers: this.headers(),
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: { userMessage?: string } };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: json.error?.userMessage ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: { userMessage?: string } };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: json.error?.userMessage ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.config.sessionToken) h["Authorization"] = `Bearer ${this.config.sessionToken}`;
    return h;
  }
}

/** Module-level singleton (most desktop code wants one client). */
export const desktopClient = new DesktopClient();
