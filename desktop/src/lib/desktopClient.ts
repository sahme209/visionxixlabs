/**
 * Desktop app's web client.
 *
 * Wraps the typed REST endpoints the web platform exposes. Honest by
 * design — when the desktop runtime isn't connected to a workspace, the
 * client returns a typed `disconnected` outcome rather than fabricating
 * data. UI surfaces show preview state accordingly.
 */

import { setDesktopTransportCredential } from "./desktopTransport";

const DEFAULT_API_BASE = "https://visionxixlabs.com";

export type DesktopConnectionState = "connecting" | "connected" | "disconnected" | "auth_required";

export interface DesktopClientConfig {
  apiBase: string;
  /** Bearer-style session token / API key. Optional during preview. */
  sessionToken?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DesktopCommercialAccess {
  allowed: boolean;
  code: "active" | "production_access_required" | "payment_past_due" | "access_canceled";
  title: string;
  message: string;
  planTier: string;
  billingStatus: string;
  accessRequestPath: string;
  pricingPath: string;
  currentPeriodEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface VerifiedDesktopIdentity {
  kind: "api_key" | "desktop_session";
  organizationId: string;
  email?: string;
  displayName?: string;
  access: DesktopCommercialAccess;
}

interface LegacyApiErrorBody {
  error?: string | { userMessage?: string };
  message?: string;
  issues?: Array<{ field?: string; message?: string }>;
}

export function legacyApiError(body: LegacyApiErrorBody, status: number): string {
  const issues = body.issues
    ?.filter((issue) => typeof issue.message === "string")
    .map((issue) => issue.field ? `${issue.field}: ${issue.message}` : issue.message)
    .filter((message): message is string => Boolean(message));
  if (issues?.length) return issues.join(" · ");
  if (typeof body.error === "string") return body.error;
  if (body.error?.userMessage) return body.error.userMessage;
  if (typeof body.message === "string") return body.message;
  return `HTTP ${status}`;
}

export function v1ApiError(body: Record<string, unknown>, status: number): string {
  const code = typeof body.error === "string" ? body.error : undefined;
  const requiredScope = typeof body.requiredScope === "string" ? body.requiredScope : undefined;
  switch (code) {
    case "missing_scope":
      return requiredScope
        ? `Your workspace credential lacks the ${requiredScope} permission. Ask a workspace administrator to issue the required scope.`
        : "Your workspace credential lacks permission for this action.";
    case "token_expired":
    case "token_revoked":
    case "unknown_token":
      return "Your workspace sign-in is no longer valid. Sign in again to continue.";
    case "commercial_access_required":
      return "This workspace does not have active paid production access.";
    case "rate_limited":
      return "The service is temporarily rate-limiting requests. Wait a moment, then try again.";
  }
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (code) return code.replaceAll("_", " ");
  return `HTTP ${status}`;
}

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
    if (config?.sessionToken) setDesktopTransportCredential(config.sessionToken);
  }

  setSession(token: string | undefined) {
    this.config = { ...this.config, sessionToken: token };
    setDesktopTransportCredential(token);
  }

  setApiBase(base: string) {
    this.config = { ...this.config, apiBase: base };
  }

  /** True when the desktop is not connected to an authenticated workspace. */
  isPreviewMode = false;

  /** True when a supported desktop credential is loaded for verification. */
  hasAuth(): boolean {
    return Boolean(this.config.sessionToken);
  }

  /**
   * A credential being present in the OS vault is not proof that it is still
   * valid. Startup calls this before mounting any authenticated workspace UI.
   */
  async verifyCurrentCredential(): Promise<ApiResult<VerifiedDesktopIdentity>> {
    const token = this.config.sessionToken;
    if (!token) return { ok: false, error: "No saved workspace credential was found." };

    if (!token.startsWith("vxlk_") && !token.startsWith("axm.desk.")) {
      return { ok: false, error: "The saved credential type is not supported." };
    }

    const result = await this.get<{
      identity: { kind: "api_key" | "desktop_session"; organizationId: string; email?: string; displayName?: string };
      access: DesktopCommercialAccess;
    }>("/api/desktop/access");
    if (!result.ok) return result;
    return { ok: true, data: { ...result.data.identity, access: result.data.access } };
  }

  desktopBillingPortal(): Promise<ApiResult<{ url: string }>> {
    return this.post("/api/desktop/billing/portal", {});
  }

  /**
   * Phase 399 — call GET /api/v1/whoami. Returns the workspace + scopes
   * + quota snapshot, or a precise auth-failure code. Doesn't fall back
   * to mock — when whoami fails, callers should show the "paste API key"
   * UI instead of pretending to be authenticated.
   */
  async v1Whoami(): Promise<ApiResult<{
    apiKey: { id: string; env: "live" | "test"; scopes: ReadonlyArray<string> };
    organization: { id: string; planTier: string };
    quota: {
      monthlyLimit: number | null;
      currentCalls: number;
      remaining: number | null;
      ratio: number | null;
      nearLimit: boolean;
    };
    serverTimeSec: number;
  }>> {
    return this.getV1("/api/v1/whoami");
  }

  /**
   * Phase 393 — call GET /api/v1/release-gate. Returns the current
   * release-gate verdict so the desktop dashboard can render a deploy-
   * ready badge.
   */
  async v1ReleaseGate(): Promise<ApiResult<{
    hasRun: boolean;
    gate?: {
      passed: boolean;
      passRate: number;
      averageScore: number;
      summary: string;
      blockers: ReadonlyArray<{ kind: string; message: string }>;
    };
    regressionCount?: number;
    improvementCount?: number;
  }>> {
    return this.getV1("/api/v1/release-gate");
  }

  /**
   * POST /api/v1/pipelines/runs — trigger a new coding pipeline run.
   * Required scope: pipeline:trigger.
   *
   * When `idempotencyKey` is supplied, the platform deduplicates retries
   * Stripe-style (Phase 402): same key + same body returns the cached
   * response, same key + different body returns 422, in-flight returns
   * 409. Pass a UUID generated client-side per click.
   */
  async v1TriggerCodingRun(args: {
    instruction: string;
    repoRef: string;
    branchHint?: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<ApiResult<{
    runId: string;
    correlationId: string;
    status: string;
    pollUrl: string;
  }>> {
    return this.postV1(
      "/api/v1/pipelines/runs",
      {
        pipelineId: "ai_coding",
        instruction: args.instruction,
        repoRef: args.repoRef,
        ...(args.branchHint ? { branchHint: args.branchHint } : {}),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      },
      args.idempotencyKey ? { "Idempotency-Key": args.idempotencyKey } : undefined,
    );
  }

  /**
   * GET /api/v1/pipelines/runs/[id] — single pipeline run + stages.
   * Required scope: pipeline:read. 404 when the runId doesn't exist
   * OR belongs to a different workspace (both collapsed to
   * "run_not_found" to prevent cross-tenant probing).
   */
  async v1GetPipelineRun(runId: string): Promise<ApiResult<{
    run: {
      id: string;
      pipelineId: string;
      status: "queued" | "running" | "succeeded" | "failed" | "awaiting_approval";
      triggeredBy: string;
      correlationId: string;
      startedAt: string;
      completedAt: string | null;
      errorSummary: string | null;
      stages: ReadonlyArray<{
        id: string;
        stageId: string;
        stageKind: string;
        ordering: number;
        status: string;
        completedAt: string | null;
        errorMessage: string | null;
      }>;
    };
  }>> {
    return this.getV1(`/api/v1/pipelines/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * GET /api/v1/connectors/health — Phase 407.
   * Per-connector health (closed-union status + reason + ratio + age).
   * Required scope: pipeline:read.
   */
  async v1ConnectorsHealth(): Promise<ApiResult<{
    generatedAt: string;
    summary: {
      healthy: number;
      degraded: number;
      stale: number;
      auth_failed: number;
      rate_limited: number;
    };
    connectors: ReadonlyArray<{
      name: string;
      category: "cloud" | "vcs" | "db" | "monitoring" | "ide";
      status: "healthy" | "degraded" | "stale" | "auth_failed" | "rate_limited";
      stage: "auth" | "rate_limit" | "staleness" | "ratio" | "ok";
      reason: string;
      successRatio: number | null;
      ageMs: number | null;
      recentSuccessCount: number;
      recentErrorCount: number;
    }>;
  }>> {
    return this.getV1("/api/v1/connectors/health");
  }

  async v1ConnectorSetupDigest<T>(): Promise<ApiResult<T>> {
    return this.getV1<T>("/api/v1/connectors/setup-digest");
  }

  /**
   * POST /api/v1/pipelines/runs/[id]/decide — Phase 406-decide.
   * Records a vote on a pipeline run paused at an awaiting_approval
   * stage. Required scope: pipeline:trigger.
   *
   * Pipeline gates default to requiredApprovers=2: a single call from
   * the desktop records ONE vote and returns `isTerminal: false` until
   * a second distinct actor votes. The two-person platform guarantee
   * holds — the desktop alone never tips a gate.
   */
  async v1DecideApproval(args: {
    runId: string;
    decision: "approved" | "rejected";
    reason?: string;
    approverUserId?: string;
  }): Promise<ApiResult<{
    runId: string;
    approvalId: string;
    vote: "approved" | "rejected";
    snapshotStatus: "pending" | "approved" | "rejected" | "expired";
    approvedCount: number;
    rejectedCount: number;
    requiredApprovers: number;
    isTerminal: boolean;
    decidedAt: string | null;
    stageTransitioned: boolean;
  }>> {
    return this.postV1(
      `/api/v1/pipelines/runs/${encodeURIComponent(args.runId)}/decide`,
      {
        decision: args.decision,
        ...(args.reason ? { reason: args.reason } : {}),
        ...(args.approverUserId ? { approverUserId: args.approverUserId } : {}),
      },
    );
  }

  /**
   * GET /api/v1/pipelines/runs — list recent pipeline runs for the
   * authenticated workspace. Required scope: pipeline:read.
   * Default page size 25, max 100. Filter by status with `status`.
   */
  async v1ListPipelineRuns(args?: {
    limit?: number;
    cursor?: string;
    status?: "running" | "succeeded" | "failed" | "awaiting_approval";
  }): Promise<ApiResult<{
    runs: ReadonlyArray<{
      id: string;
      pipelineId: string;
      status: string;
      triggeredBy: string;
      correlationId: string;
      startedAt: string;
      completedAt: string | null;
      errorSummary: string | null;
      stageCount: number;
    }>;
    nextCursor: string | null;
  }>> {
    const params = new URLSearchParams();
    if (args?.limit)  params.set("limit",  String(args.limit));
    if (args?.cursor) params.set("cursor", args.cursor);
    if (args?.status) params.set("status", args.status);
    const qs = params.toString();
    return this.getV1(`/api/v1/pipelines/runs${qs ? "?" + qs : ""}`);
  }

  // ── Command center / control plane ────────────────────────────────
  commandCenterState():  Promise<ApiResult<CommandCenterStateLite>>   { return this.get("/api/command-center"); }

  async controlPlaneState(): Promise<ApiResult<ControlPlaneStateLite>> {
    // When a desktop session token is paired, prefer the Bearer-authenticated
    // endpoint so the call works cross-origin (cookie auth would fail).
    if (this.config.sessionToken) {
      const wrapped = await this.get<{ state: ControlPlaneStateLite }>("/api/desktop/state");
      if (wrapped.ok && wrapped.data?.state) {
        this.isPreviewMode = false;
        return { ok: true, data: wrapped.data.state };
      }
    }
    const res = await this.get<ControlPlaneStateLite>("/api/control-plane/state");
    if (res.ok) { this.isPreviewMode = false; return res; }
    this.isPreviewMode = true;
    return res;
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
    this.isPreviewMode = !res.ok;
    return res;
  }

  // ── Remediation ───────────────────────────────────────────────────
  async remediationPlan(): Promise<ApiResult<RemediationPipelineLite>> {
    const res = await this.post<RemediationPipelineLite>("/api/remediation/plan", {});
    this.isPreviewMode = !res.ok;
    return res;
  }
  remediationCandidates(): Promise<ApiResult<{ candidates: RemediationCandidateLite[] }>> { return this.post("/api/remediation/candidates", {}); }

  // ── Simulation ────────────────────────────────────────────────────
  async simulationsBatch(): Promise<ApiResult<SimulationsBatchLite>> {
    const res = await this.post<SimulationsBatchLite>("/api/simulations/create", {});
    this.isPreviewMode = !res.ok;
    return res;
  }
  simulationFromRemediation(candidateId: string): Promise<ApiResult<{ result: SimulationResultLite }>> {
    return this.post("/api/simulations/from-remediation", { candidateId });
  }

  // ── Orchestration ─────────────────────────────────────────────────
  async orchestration(): Promise<ApiResult<OrchestrationListLite>> {
    const res = await this.get<OrchestrationListLite>("/api/orchestration");
    this.isPreviewMode = !res.ok;
    return res;
  }
  decideApproval(id: string, decision: "approved" | "rejected", reason?: string): Promise<ApiResult<unknown>> {
    return this.post(`/api/orchestration/approvals/${encodeURIComponent(id)}/decide`, { decision, reason });
  }

  // ── Deployment operations ─────────────────────────────────────────
  integrationStatus(): Promise<ApiResult<Array<{
    provider: "aws" | "azure" | "gcp";
    status: string;
    lastTransitionAt: string | null;
  }>>> {
    return this.get("/api/desktop/integrations");
  }

  aiProviderStatus(): Promise<ApiResult<Array<{
    provider: string;
    configured: boolean;
    defaultModel: string;
  }>>> {
    return this.get("/api/desktop/ai-providers");
  }

  deploymentRequests(): Promise<ApiResult<Array<{
    id: string;
    title: string;
    status: string;
    version: number;
    correlationId: string;
    submittedAt: string | null;
    updatedAt: string;
    releaseContext: {
      window: { startUtc: string; endUtc: string; displayTimeZone: string } | null;
      scope: { applicationCount: number; repositoryCount: number; targetEnvironment: string | null };
      approval: { prStatus: string; noPrRequired: boolean };
      readiness: {
        developmentReady: boolean;
        productionReady: boolean;
        validationStepCount: number;
        deferredValidation: boolean;
        approvalDecision: "ready_for_human_approval" | "needs_attention";
        blockers: string[];
      };
      recovery: { rollbackAvailability: string; backupRequired: boolean; evidenceCount: number };
    };
    latestPlaybook: {
      id: string;
      version: number;
      status: string;
      contentHash: string;
      createdAt: string;
    } | null;
  }>>> {
    return this.get("/api/desktop/deployments");
  }

  createDeploymentRequest(
    intake: Record<string, unknown>,
    idempotencyId: string,
  ): Promise<ApiResult<{
    id: string;
    title: string;
    status: string;
    version: number;
    correlationId: string;
    submittedAt: string | null;
    replayed: boolean;
  }>> {
    return this.post(
      "/api/desktop/deployments",
      intake,
      { "x-correlation-id": idempotencyId },
    );
  }

  generateDeploymentPlaybook(requestId: string): Promise<ApiResult<{
    id: string;
    requestId: string;
    version: number;
    status: string;
    contentHash: string;
    generatedAtUtc: string;
    scope: string;
    stepCount: number;
    steps: Array<{
      id: string;
      order: number;
      type: string;
      title: string;
      requiredRole: string;
      requiresHumanConfirmation: boolean;
      evidenceRequired: boolean;
      instructions: string;
      validationInstruction?: string;
      activation: "always" | "on_success" | "on_failure";
      status: string;
    }>;
  }>> {
    return this.post(
      `/api/desktop/deployments/${encodeURIComponent(requestId)}/playbooks`,
      {},
    );
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
      const json = (await res.json().catch(() => ({}))) as LegacyApiErrorBody & { ok?: boolean; data?: unknown };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: legacyApiError(json, res.status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * v1 envelope: { ok, ...payload } on success, { ok: false, error, message?, retryAfterSeconds? }
   * on failure. Different shape from the legacy { ok, data } wrap — the v1
   * routes return the payload at the top level (see app/api/v1/*).
   */
  private async getV1<T>(path: string): Promise<ApiResult<T>> {
    return this.executeV1<T>("GET", path);
  }

  /**
   * POST variant of getV1. Accepts a JSON body + optional extra headers
   * (e.g. `Idempotency-Key` for Phase 402's deduplication).
   */
  private async postV1<T>(
    path: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    return this.executeV1<T>("POST", path, JSON.stringify(body), extraHeaders);
  }

  private async executeV1<T>(
    method: "GET" | "POST",
    path: string,
    body?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method,
        headers: {
          ...this.headers(),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(extraHeaders ?? {}),
        },
        body,
      });
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = text.length > 0 ? JSON.parse(text) : {}; } catch { /* leave empty */ }
      if (res.ok && parsed.ok === true) {
        return { ok: true, data: parsed as unknown as T };
      }
      return { ok: false, error: v1ApiError(parsed, res.status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async post<T>(
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          ...(extraHeaders ?? {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as LegacyApiErrorBody & { ok?: boolean; data?: unknown };
      if (json.ok && json.data !== undefined) return { ok: true, data: json.data as T };
      return { ok: false, error: legacyApiError(json, res.status) };
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
