/**
 * Technical reference for the demo system.
 *
 * Pure data — one place to read what every closed-union member means,
 * what every endpoint returns, what every webhook event carries. The
 * /demo/reference page renders the whole thing; per-scenario panels
 * pull subsets.
 *
 * Why this lives separately:
 *   - The closed-unions in lib/ are source of truth for safety; this
 *     module is source of truth for *explanation*.
 *   - When the platform adds an endpoint / event / action, the
 *     mismatch between the closed-union and this catalog surfaces
 *     immediately in PR review.
 */

// ─── API endpoints ───────────────────────────────────────────────────

export interface ApiEndpoint {
  method: "GET" | "POST";
  path: string;
  scope: string;
  oneLine: string;
  detail: string;
  /** Sample request body (for POST). null for GET. */
  reqBody?: string;
  /** Sample successful response. */
  resBody: string;
  /** Closed-union of error codes the endpoint can return. */
  errorCodes: ReadonlyArray<string>;
}

/**
 * Pick the most relevant API endpoint for a given step. Used by the
 * walkthrough to show a payload preview alongside the visual mock.
 * Heuristic on step.title + description + connector — returns null when
 * the step doesn't map to a single canonical endpoint.
 */
export function endpointForStep(args: { title: string; description: string; route?: string; relatedConnector?: string }): ApiEndpoint | null {
  const t = (args.title + " " + args.description).toLowerCase();
  if (t.includes("approval") && (t.includes("approve") || t.includes("reject") || t.includes("vote") || t.includes("two-person"))) {
    return API_ENDPOINTS.find((e) => e.path.endsWith("/decide")) ?? null;
  }
  if (t.includes("trigger") || t.includes("pipeline") || t.includes("coding")) {
    return API_ENDPOINTS.find((e) => e.method === "POST" && e.path === "/api/v1/pipelines/runs") ?? null;
  }
  if (t.includes("poll") || t.includes("status") || t.includes("workflow runs")) {
    return API_ENDPOINTS.find((e) => e.path.includes("/pipelines/runs/[id]")) ?? null;
  }
  if (t.includes("release gate") || t.includes("gate")) {
    return API_ENDPOINTS.find((e) => e.path === "/api/v1/release-gate") ?? null;
  }
  if (t.includes("workspace") && (t.includes("paired") || t.includes("connection"))) {
    return API_ENDPOINTS.find((e) => e.path === "/api/v1/whoami") ?? null;
  }
  if (t.includes("webhook") && (t.includes("verify") || t.includes("jwks") || t.includes("signature"))) {
    return API_ENDPOINTS.find((e) => e.path.includes("/webhooks/jwks")) ?? null;
  }
  return null;
}

export const API_ENDPOINTS: ReadonlyArray<ApiEndpoint> = [
  {
    method: "GET",
    path: "/api/v1/whoami",
    scope: "any read-class",
    oneLine: "Identifies the calling key + workspace + plan + quota.",
    detail:
      "Cheap probe used at the start of any session. Returns the key prefix (never the secret), its env (live/test), the organization id + plan tier, and the month-to-date v1 quota with a nearLimit flag at 90%.",
    resBody: `{
  "ok": true,
  "apiKey": { "id": "ak_…", "env": "live",
              "scopes": ["pipeline:read", "pipeline:trigger"] },
  "organization": { "id": "ws_acme_prod", "planTier": "pro" },
  "quota": { "monthlyLimit": 10000, "currentCalls": 7420,
             "remaining": 2580, "ratio": 0.74, "nearLimit": false },
  "serverTimeSec": 1716506400
}`,
    errorCodes: ["no_bearer_token", "malformed_token", "unknown_token", "token_revoked", "rate_limited"],
  },
  {
    method: "GET",
    path: "/api/v1/release-gate",
    scope: "release_gate:read",
    oneLine: "Latest release-gate verdict for the workspace.",
    detail:
      "Returns whether the last eval run cleared the release gate, the pass-rate, average score, summary, and any structured blockers. Drives the deploy-ready badge on the Activity view.",
    resBody: `{
  "ok": true,
  "hasRun": true,
  "gate": {
    "passed": true,
    "passRate": 0.94,
    "averageScore": 8.7,
    "summary": "All 142 evals passing.",
    "blockers": []
  },
  "regressionCount": 0,
  "improvementCount": 4
}`,
    errorCodes: ["missing_scope", "quota_exhausted"],
  },
  {
    method: "POST",
    path: "/api/v1/pipelines/runs",
    scope: "pipeline:trigger",
    oneLine: "Kick off a coding pipeline run.",
    detail:
      "Validates the input, claims an optional Idempotency-Key slot Stripe-style, and starts the runner. 24h idempotency TTL. Returns 202 Accepted; caller polls the GET endpoint or subscribes to pipeline.* webhooks.",
    reqBody: `{
  "pipelineId": "ai_coding",
  "instruction": "Add a /healthz route returning 200 OK.",
  "repoRef": "acme/example",
  "branchHint": "main",
  "metadata": { "ticket": "ACME-1242" }
}

# Optional header:
# Idempotency-Key: 9c7a32f8-12c4-4f8e-…`,
    resBody: `{
  "ok": true,
  "runId": "ckpipe_98zxa9q",
  "correlationId": "pipe_ai_coding_1ax9zq",
  "status": "running",
  "pollUrl": "/api/v1/pipelines/runs/ckpipe_98zxa9q"
}`,
    errorCodes: ["invalid_json", "invalid_pipeline_id", "invalid_repo_ref", "missing_scope", "in_flight", "body_mismatch", "idempotency_key_invalid", "quota_exhausted"],
  },
  {
    method: "GET",
    path: "/api/v1/pipelines/runs/[id]",
    scope: "pipeline:read",
    oneLine: "Poll one pipeline run's status + stages.",
    detail:
      "Cross-tenant-safe lookup. 404 collapses missing-and-different-tenant to the same response so attackers can't probe for cross-org run ids.",
    resBody: `{
  "ok": true,
  "run": {
    "id": "ckpipe_98zxa9q",
    "pipelineId": "ai_coding",
    "status": "awaiting_approval",
    "triggeredBy": "alice@acme.com",
    "correlationId": "pipe_ai_coding_1ax9zq",
    "startedAt": "2026-05-23T17:51:00.000Z",
    "completedAt": null,
    "errorSummary": null,
    "stages": [
      { "id": "csg_…", "stageId": "read",     "status": "succeeded" },
      { "id": "csg_…", "stageId": "propose",  "status": "succeeded" },
      { "id": "csg_…", "stageId": "approval", "status": "awaiting_approval" }
    ]
  }
}`,
    errorCodes: ["run_not_found", "missing_scope"],
  },
  {
    method: "GET",
    path: "/api/v1/pipelines/runs",
    scope: "pipeline:read",
    oneLine: "List recent runs, paginated + status-filterable.",
    detail:
      "Cursor pagination by run id (descending creation order). Filter by status (running | succeeded | failed | awaiting_approval). Used by the Activity view + tray badge + ApprovalsView.",
    resBody: `{
  "ok": true,
  "runs": [
    { "id": "ckpipe_…", "pipelineId": "ai_coding",
      "status": "awaiting_approval", "stageCount": 6, … }
  ],
  "nextCursor": "ckpipe_98zwbpy"
}`,
    errorCodes: ["missing_scope", "quota_exhausted"],
  },
  {
    method: "POST",
    path: "/api/v1/pipelines/runs/[id]/decide",
    scope: "pipeline:trigger",
    oneLine: "Vote on a paused awaiting_approval stage.",
    detail:
      "Records ONE vote. Pipeline gates default to requiredApprovers=2 so isTerminal stays false until a second distinct approver votes. Fires the pipeline.stage_decision_recorded webhook on every vote (terminal or partial).",
    reqBody: `{
  "decision": "approved",
  "reason": "Reviewed diff + rollback plan",
  "approverUserId": "desktop_tray"
}`,
    resBody: `{
  "ok": true,
  "runId": "ckpipe_98zxa9q",
  "approvalId": "apr_pipe_ckpipe_98zxa9q_1ax",
  "vote": "approved",
  "snapshotStatus": "pending",
  "approvedCount": 1,
  "rejectedCount": 0,
  "requiredApprovers": 2,
  "isTerminal": false,
  "decidedAt": null,
  "stageTransitioned": false
}`,
    errorCodes: ["invalid_decision", "run_not_found", "cross_tenant", "no_pending_approval", "approval_not_found", "already_decided", "already_voted", "missing_scope"],
  },
  {
    method: "GET",
    path: "/api/v1/events/stream",
    scope: "pipeline:read",
    oneLine: "Long-lived SSE event stream (Phase 409).",
    detail:
      "Server-Sent Events. Replaces polling with push: approvals snapshots every 5s, connector snapshots every 30s, heartbeats every 25s to defeat any intermediate proxy idle-timeout. Closed-union event kinds: heartbeat · approvals.snapshot · connectors.snapshot · stream.ready · stream.shutdown. Subscribe via `?subscribe=approvals.snapshot,heartbeat` (default = wildcard). Server enforces a 5-minute max connection lifetime + emits stream.shutdown so clients can cleanly reconnect.",
    resBody: `event: stream.ready
data: { "correlationId": "v1_events_stream_…", "filter": ["approvals.snapshot","heartbeat"], "scopes": ["pipeline:read"] }
id: 1

event: approvals.snapshot
data: { "generatedAt": "2026-05-23T19:00:00.000Z", "count": 3, "runs": [ … ] }
id: 2

event: heartbeat
data: { "atSec": 25 }
id: 3`,
    errorCodes: ["missing_scope", "token_expired", "token_revoked", "quota_exhausted"],
  },
  {
    method: "GET",
    path: "/api/v1/connectors/health",
    scope: "pipeline:read",
    oneLine: "Per-connector health telemetry (Phase 407).",
    detail:
      "Closed-union status (healthy · degraded · stale · auth_failed · rate_limited) computed by a pure kernel from per-connector telemetry (last sync time, recent success / error counts, auth probe, rate-limit cooldown). Same inputs → same status, unit-tested against a fixture set.",
    resBody: `{
  "ok": true,
  "generatedAt": "2026-05-23T18:00:00.000Z",
  "summary": {
    "healthy": 3, "degraded": 0,
    "stale": 1, "auth_failed": 0, "rate_limited": 0
  },
  "connectors": [
    {
      "name": "AWS", "category": "cloud",
      "status": "healthy", "stage": "ok",
      "reason": "Connector is syncing successfully.",
      "successRatio": 0.947, "ageMs": 78420,
      "recentSuccessCount": 18, "recentErrorCount": 1
    },
    {
      "name": "Postgres", "category": "db",
      "status": "stale", "stage": "staleness",
      "reason": "Last successful sync was 10m ago (window for db: 5m).",
      "successRatio": 0.857, "ageMs": 600000,
      "recentSuccessCount": 6, "recentErrorCount": 1
    }
  ]
}`,
    errorCodes: ["missing_scope", "quota_exhausted"],
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/jwks",
    scope: "(public — no auth)",
    oneLine: "Public ES256 verification keys.",
    detail:
      "RFC 7517 JWK Set. Carries the rotating public keys integrators use to verify ES256 webhook signatures. Cached 1h at the CDN edge, 5m at the origin. kid is an RFC 7638 thumbprint.",
    resBody: `{
  "keys": [
    {
      "kty": "EC", "crv": "P-256", "use": "sig", "alg": "ES256",
      "kid": "f8a12b…", "x": "…", "y": "…"
    }
  ]
}`,
    errorCodes: [],
  },
];

// ─── Webhook events ──────────────────────────────────────────────────

export interface WebhookEventSpec {
  kind: string;
  oneLine: string;
  /** When this event is emitted (producer site). */
  emittedFrom: string;
  /** Sample payload data. */
  payload: string;
}

export const WEBHOOK_EVENTS: ReadonlyArray<WebhookEventSpec> = [
  {
    kind: "release_gate.passed",
    oneLine: "Eval run cleared the release gate.",
    emittedFrom: "lib/workforce/releaseGate/passReleaseGate.ts",
    payload: `{ "evalRunId": "evr_…", "passRate": 0.94,
  "averageScore": 8.7, "regressionCount": 0 }`,
  },
  {
    kind: "release_gate.blocked",
    oneLine: "Eval run failed the release gate.",
    emittedFrom: "lib/workforce/releaseGate/blockReleaseGate.ts",
    payload: `{ "evalRunId": "evr_…", "blockers": [
    { "kind": "regression", "message": "case_42 below threshold" }
  ] }`,
  },
  {
    kind: "eval.regression_detected",
    oneLine: "A baseline-tagged eval case dropped below threshold.",
    emittedFrom: "lib/workforce/evals/regressionDetector.ts",
    payload: `{ "evalRunId": "evr_…", "caseId": "case_42",
  "currentScore": 6.2, "baselineScore": 8.8 }`,
  },
  {
    kind: "eval.run_completed",
    oneLine: "Eval run finished (pass or fail).",
    emittedFrom: "lib/workforce/evals/finalizeEvalRun.ts",
    payload: `{ "evalRunId": "evr_…", "passRate": 0.94,
  "averageScore": 8.7 }`,
  },
  {
    kind: "pipeline.run_started",
    oneLine: "PipelineRun row created, runner kicked off.",
    emittedFrom: "lib/workforce/pipelines/pipelineRunner.ts:startPipelineRun",
    payload: `{ "runId": "ckpipe_…", "pipelineId": "ai_coding",
  "triggeredBy": "alice@acme.com", "stageCount": 6 }`,
  },
  {
    kind: "pipeline.run_completed",
    oneLine: "All stages succeeded.",
    emittedFrom: "lib/workforce/pipelines/pipelineRunner.ts:advancePipelineRun",
    payload: `{ "runId": "ckpipe_…", "completedAt": "2026-05-23T17:58:00Z",
  "stageCount": 6 }`,
  },
  {
    kind: "pipeline.run_failed",
    oneLine: "Run hit a terminal failure.",
    emittedFrom: "lib/workforce/pipelines/pipelineRunner.ts:advancePipelineRun",
    payload: `{ "runId": "ckpipe_…", "failedOrdering": 3,
  "errorSummary": "Stage ordering=3 failed." }`,
  },
  {
    kind: "pipeline.stage_failed",
    oneLine: "One stage failed (possibly recoverable mid-run).",
    emittedFrom: "lib/workforce/pipelines/pipelineRunner.ts",
    payload: `{ "runId": "ckpipe_…", "stageRunId": "csg_…",
  "stageKind": "lint", "reason": "budget_exceeded" }`,
  },
  {
    kind: "pipeline.stage_decision_recorded",
    oneLine: "Vote landed on a paused approval stage.",
    emittedFrom: "app/api/v1/pipelines/runs/[id]/decide/route.ts",
    payload: `{ "runId": "ckpipe_…", "approvalId": "apr_pipe_…",
  "vote": "approved", "approverUserId": "desktop_tray",
  "approvedCount": 1, "requiredApprovers": 2,
  "isTerminal": false, "snapshotStatus": "pending" }`,
  },
  {
    kind: "coding.pr_opened",
    oneLine: "AI coding run opened a PR.",
    emittedFrom: "lib/workforce/coding/openCodingPr.ts",
    payload: `{ "runId": "ckpipe_…", "prUrl": "https://github.com/acme/example/pull/24" }`,
  },
  {
    kind: "coding.lint_failed",
    oneLine: "Lint stage rejected the proposal.",
    emittedFrom: "lib/workforce/coding/lintStage.ts",
    payload: `{ "runId": "ckpipe_…", "errors": [
    { "file": "src/index.ts", "line": 14, "rule": "no-unused-vars" }
  ] }`,
  },
  {
    kind: "coding.test_failed",
    oneLine: "Test stage rejected the proposal.",
    emittedFrom: "lib/workforce/coding/testStage.ts",
    payload: `{ "runId": "ckpipe_…", "failed": ["MyClass#shouldFoo"] }`,
  },
  {
    kind: "api_key.created",
    oneLine: "vxlk_* key minted (admin surface).",
    emittedFrom: "app/admin/api-keys/createApiKey.action.ts",
    payload: `{ "apiKeyId": "ak_…", "env": "live",
  "scopes": ["pipeline:read", "pipeline:trigger"] }`,
  },
  {
    kind: "api_key.revoked",
    oneLine: "Key invalidated; subsequent calls return token_revoked.",
    emittedFrom: "app/admin/api-keys/revokeApiKey.action.ts",
    payload: `{ "apiKeyId": "ak_…", "revokedAt": "2026-05-23T17:58:00Z" }`,
  },
  {
    kind: "billing.threshold_crossed",
    oneLine: "Usage crossed a 70 / 90 / 100 % bucket.",
    emittedFrom: "lib/billing/alertScanner.ts",
    payload: `{ "dimension": "api_v1_calls", "ratio": 0.91,
  "bucket": "90pct" }`,
  },
  {
    kind: "billing.quota_exhausted",
    oneLine: "Monthly cap hit; subsequent calls 429.",
    emittedFrom: "lib/security/authenticateApiKey.ts",
    payload: `{ "dimension": "api_v1_calls",
  "retryAfterSeconds": 432000 }`,
  },
];

// ─── Closed-union types ──────────────────────────────────────────────

export interface ClosedUnionSpec {
  name: string;
  source: string;
  members: ReadonlyArray<{ value: string; meaning: string }>;
}

export const CLOSED_UNIONS: ReadonlyArray<ClosedUnionSpec> = [
  {
    name: "ApiKeyScope",
    source: "lib/security/apiKeyScope.ts",
    members: [
      { value: "pipeline:read",     meaning: "List + get pipeline runs." },
      { value: "pipeline:trigger",  meaning: "Start runs + decide approvals." },
      { value: "pipeline:*",        meaning: "Both pipeline scopes." },
      { value: "eval:read",         meaning: "Read eval runs + results." },
      { value: "eval:write",        meaning: "Submit eval cases / runs." },
      { value: "eval:*",            meaning: "Both eval scopes." },
      { value: "release_gate:read", meaning: "Read release-gate verdicts." },
      { value: "release_gate:*",    meaning: "Same — gates aren't user-controllable." },
      { value: "webhook:read",      meaning: "List endpoints + deliveries." },
      { value: "webhook:write",     meaning: "Create / update endpoints." },
      { value: "webhook:admin",     meaning: "Rotate signing keys." },
      { value: "webhook:*",         meaning: "All webhook scopes." },
      { value: "*",                 meaning: "Universal admin — Enterprise only." },
    ],
  },
  {
    name: "DemoStepApproval",
    source: "lib/demo/demoScenarios.ts",
    members: [
      { value: "none",         meaning: "No approval gate; read-only or operator self-action." },
      { value: "self_approve", meaning: "Operator acts on their own behalf (audited)." },
      { value: "two_person",   meaning: "Two distinct human approvers required to advance." },
    ],
  },
  {
    name: "DemoAudience",
    source: "lib/demo/demoScenarios.ts",
    members: [
      { value: "public",        meaning: "Visible on /demo without an API key (marketing-grade walkthroughs)." },
      { value: "client",        meaning: "Shown to paired workspaces in /demo." },
      { value: "internal_only", meaning: "Admin-only; never surfaced to client workspaces." },
    ],
  },
  {
    name: "WorkspaceKind",
    source: "lib/workspace/workspaceKind.ts",
    members: [
      { value: "real",     meaning: "Paying customer; demo data is forbidden by assertNotDemoLeak()." },
      { value: "sandbox",  meaning: "Public /demo workspaces; safe to render mock data." },
      { value: "internal", meaning: "Admin / eval runner; can see internal_only scenarios." },
    ],
  },
  {
    name: "DataSourceMode",
    source: "desktop/src/components/Primitives.tsx",
    members: [
      { value: "live",                    meaning: "API key paired + endpoint returned real data." },
      { value: "authenticated_no_data",   meaning: "Key paired but surface not implemented yet — shows mock." },
      { value: "preview",                 meaning: "No key paired; showing mock data." },
    ],
  },
  {
    name: "AuthFailureKind",
    source: "lib/security/authenticateApiKey.ts",
    members: [
      { value: "no_bearer_token",  meaning: "Authorization header missing." },
      { value: "malformed_token",  meaning: "Header doesn't parse as vxlk_*." },
      { value: "unknown_token",    meaning: "No row match — collapses 'no row' + 'hash mismatch' to one outcome." },
      { value: "token_expired",    meaning: "expiresAt < now." },
      { value: "token_revoked",    meaning: "revokedAt set." },
      { value: "missing_scope",    meaning: "Granted scopes don't include the required scope." },
      { value: "rate_limited",     meaning: "Per-prefix rate-limit bucket exhausted." },
      { value: "quota_exhausted",  meaning: "Monthly plan quota hit." },
    ],
  },
  {
    name: "PipelineRun.status",
    source: "prisma/schema.prisma",
    members: [
      { value: "queued",              meaning: "Run row created, no stage has started yet." },
      { value: "running",             meaning: "At least one stage in flight." },
      { value: "awaiting_approval",   meaning: "Paused at an approval gate." },
      { value: "succeeded",           meaning: "All stages succeeded; terminal." },
      { value: "failed",              meaning: "One stage failed terminally; terminal." },
      { value: "cancelled",           meaning: "Operator cancelled mid-run." },
    ],
  },
  {
    name: "StreamEventKind",
    source: "lib/events/streamKernel.ts (Phase 409)",
    members: [
      { value: "heartbeat",           meaning: "Keep-alive ping every 25s so intermediate proxies don't idle the SSE connection out." },
      { value: "approvals.snapshot",  meaning: "Full snapshot of awaiting_approval runs (every 5s + on connect)." },
      { value: "connectors.snapshot", meaning: "Full per-connector health snapshot (every 30s + on connect)." },
      { value: "stream.ready",        meaning: "First frame sent after a successful subscribe; carries the correlationId + applied filter." },
      { value: "stream.shutdown",     meaning: "Server-initiated close (max_lifetime_reached / client_disconnect). Client should reconnect cleanly." },
    ],
  },
  {
    name: "ConnectorHealthStatus",
    source: "lib/connectors/connectorHealth.ts (Phase 407)",
    members: [
      { value: "healthy",      meaning: "Connector is syncing successfully within bounds." },
      { value: "degraded",     meaning: "Recent success ratio below threshold (default 85%) with at least 5 samples." },
      { value: "stale",        meaning: "Last successful sync older than the category window (cloud 30m · vcs 10m · db 5m · monitoring 15m). 'Never synced' counts as stale." },
      { value: "auth_failed",  meaning: "Credentials rejected on the most recent auth probe — beats every other signal." },
      { value: "rate_limited", meaning: "Provider is throttling us right now; scanner is backing off." },
    ],
  },
  {
    name: "ApprovalSnapshot.status",
    source: "prisma/schema.prisma (EngineerApprovalSnapshot)",
    members: [
      { value: "pending",  meaning: "Awaiting votes." },
      { value: "approved", meaning: "Quorum reached affirmatively." },
      { value: "rejected", meaning: "Quorum reached negatively." },
      { value: "expired",  meaning: "Auto-expired by the sweeper before reaching quorum." },
    ],
  },
];

// ─── Audit actions (grouped for readability) ─────────────────────────

export interface AuditCategory {
  name: string;
  actions: ReadonlyArray<string>;
}

export const AUDIT_CATEGORIES: ReadonlyArray<AuditCategory> = [
  { name: "Auth / session",       actions: ["auth.signin", "auth.signout", "auth.failed"] },
  { name: "Tenant isolation",     actions: ["tenant.cross_attempt"] },
  { name: "Connectors",           actions: ["connector.connect", "connector.disconnect", "connector.validate.attempt", "connector.validate.success", "connector.validate.failure"] },
  { name: "Scans",                actions: ["scan.start", "scan.success", "scan.failure"] },
  { name: "Recommendations",      actions: ["recommendation.generated"] },
  { name: "Execution",            actions: ["execution_plan.create", "execution_plan.export", "execution_plan.submit", "execution_plan.execute", "rollback.prepare", "rollback.execute"] },
  { name: "Approvals",            actions: ["approval.grant", "approval.deny"] },
  { name: "Desktop",              actions: ["desktop.pair", "desktop.revoke", "desktop.handoff.issue", "desktop.handoff.verify", "desktop.handoff.reject"] },
  { name: "Governance / policy",  actions: ["policy.update", "governance.update", "autonomy.change", "members.invite", "members.remove"] },
  { name: "Audit data",           actions: ["audit.export"] },
  { name: "Copilot",              actions: ["copilot.query", "copilot.blocked"] },
  { name: "AI Workforce runtime", actions: ["engineer.action_attempted", "engineer.action_allowed", "engineer.action_requires_approval", "engineer.action_blocked", "engineer.approval_created", "engineer.approval_voted", "engineer.approval_expired", "engineer.action_executed", "engineer.action_execution_failed", "engineer.policy_override_updated", "engineer.registry_synced"] },
  { name: "Billing",              actions: ["billing.usage_recorded", "billing.credit_pool_exhausted", "billing.summary_rebuilt", "billing.entitlement_blocked", "billing.alert_fired", "billing.addon_purchase_initiated", "billing.addon_purchase_completed", "billing.addon_purchase_refunded"] },
  { name: "Pipelines",            actions: ["pipeline.run_started", "pipeline.stage_started", "pipeline.stage_completed", "pipeline.stage_failed", "pipeline.run_completed", "pipeline.run_failed"] },
  { name: "Repo context",         actions: ["workforce.repo_context_fetched", "workforce.repo_context_fetch_failed"] },
  { name: "PR open",              actions: ["workforce.pr_branch_pushed", "workforce.pr_opened", "workforce.pr_open_failed"] },
  { name: "Evals",                actions: ["eval.run_started", "eval.case_recorded", "eval.run_completed", "eval.run_failed", "eval.regression_detected", "eval.release_gate_passed", "eval.release_gate_blocked"] },
  { name: "Refinement",           actions: ["workforce.proposal_refined", "workforce.proposal_gave_up"] },
  { name: "Static lint",          actions: ["workforce.code_lint_passed", "workforce.code_lint_failed"] },
  { name: "Test integrity",       actions: ["workforce.code_test_passed", "workforce.code_test_failed"] },
  { name: "API keys",             actions: ["workforce.api_key_created", "workforce.api_key_revoked", "workforce.api_key_authenticated", "workforce.api_key_denied"] },
  { name: "Webhook delivery",     actions: ["workforce.webhook_endpoint_created", "workforce.webhook_endpoint_revoked", "workforce.webhook_event_dispatched", "workforce.webhook_delivered", "workforce.webhook_retry_scheduled", "workforce.webhook_deadlettered", "workforce.webhook_queue_processed"] },
  { name: "Budget / idempotency", actions: ["workforce.budget_config_created", "workforce.budget_config_updated", "workforce.budget_config_deleted", "workforce.idempotency_slot_completed"] },
  { name: "Model routing",        actions: ["workforce.model_downgraded"] },
  { name: "Generic",              actions: ["system.error"] },
];

// ─── Connectors ──────────────────────────────────────────────────────

export interface ConnectorSpec {
  name: string;
  category: "cloud" | "vcs" | "db" | "monitoring" | "ide";
  authModel: string;
  scopes: string;
  /** What the platform reads / can't read. */
  capability: string;
}

export const CONNECTORS: ReadonlyArray<ConnectorSpec> = [
  { name: "AWS",        category: "cloud",      authModel: "Cross-account IAM role + externalId · sts:AssumeRole",       scopes: "Read-only at install (list-*, describe-*); write scopes opt-in per remediation action.",   capability: "Inventory · cost · IAM exposure · CloudTrail · drift detection." },
  { name: "Azure",      category: "cloud",      authModel: "Service principal · Reader role on subscription",            scopes: "Read-only at install.",                                                                       capability: "Inventory · RBAC posture · Key Vault audit." },
  { name: "GCP",        category: "cloud",      authModel: "Service account · roles/iam.securityReviewer",                 scopes: "Read-only at install.",                                                                       capability: "Inventory · IAM posture · audit logs." },
  { name: "GitHub",     category: "vcs",        authModel: "OAuth app · repo + workflow scopes (read-only at install)",   scopes: "Reads repos + workflow runs; PR open requires explicit elevation.",                            capability: "DevOps Engineer reads pipeline status + explains failures." },
  { name: "Postgres",   category: "db",         authModel: "Read-only DB user · pg_monitor + pg_read_server_files",       scopes: "Read schema + slow-query logs; NO write tools by default.",                                  capability: "Database Engineer detects slow queries + backup gaps." },
  { name: "MySQL",      category: "db",         authModel: "Read-only DB user · SELECT on information_schema.*",          scopes: "Read schema + slow-query log.",                                                              capability: "Same as Postgres." },
  { name: "MongoDB",    category: "db",         authModel: "Read-only DB user · listDatabases + collStats",                scopes: "Read collections + stats.",                                                                  capability: "Schema + slow-op detection." },
  { name: "CloudWatch", category: "monitoring", authModel: "Ingest webhook · HMAC-SHA256 signed",                          scopes: "Inbound only — platform never writes back.",                                                 capability: "Monitoring Engineer correlates alerts with recent deploys." },
  { name: "Grafana",    category: "monitoring", authModel: "Ingest webhook · HMAC-SHA256 signed",                          scopes: "Inbound only.",                                                                              capability: "Same as CloudWatch." },
  { name: "Dynatrace",  category: "monitoring", authModel: "Ingest webhook · HMAC-SHA256 signed",                          scopes: "Inbound only.",                                                                              capability: "Same as CloudWatch." },
  { name: "VS Code",    category: "ide",        authModel: "API key (same as desktop) · workspace-scoped",                 scopes: "Whatever scopes the key carries.",                                                            capability: "DevOps Engineer chat panel cites back to log lines." },
];

// ─── AI engineers ────────────────────────────────────────────────────

export interface EngineerSpec {
  name: string;
  scopeOneLine: string;
  tools: ReadonlyArray<string>;
  defaultApproval: "none" | "self_approve" | "two_person";
}

export const ENGINEERS: ReadonlyArray<EngineerSpec> = [
  { name: "Cloud Engineer",      scopeOneLine: "Scans, plans, and recommends cloud-infra fixes across AWS / Azure / GCP.", tools: ["cloud.scan", "cloud.plan", "cloud.recommend", "cloud.terraform_diff", "cloud.rollback_plan", "cloud.simulate", "cloud.budget"], defaultApproval: "two_person" },
  { name: "DevOps Engineer",     scopeOneLine: "Reads CI status, explains failures, suggests PRs.",                          tools: ["github.read_workflow", "github.read_logs", "github.suggest_pr", "github.read_commit", "github.open_pr"],                     defaultApproval: "two_person" },
  { name: "Security Engineer",   scopeOneLine: "IAM + findings + advisories with severity-scored evidence.",                  tools: ["sec.scan", "sec.severity", "sec.terraform_diff", "sec.compliance_bind", "sec.advise", "sec.rollback_plan"],                 defaultApproval: "two_person" },
  { name: "Database Engineer",   scopeOneLine: "Schema introspection + slow query + backup gap detection.",                   tools: ["db.read_schema", "db.read_slowlog", "db.propose_ddl", "db.simulate_impact"],                                                defaultApproval: "two_person" },
  { name: "Monitoring Engineer", scopeOneLine: "Alert ingestion + deploy/config correlation.",                                  tools: ["mon.read_metric", "mon.read_alert", "mon.correlate_deploy", "mon.create_incident"],                                       defaultApproval: "none" },
  { name: "Incident Engineer",   scopeOneLine: "Timeline + root cause + postmortem skeleton.",                                  tools: ["inc.build_timeline", "inc.hypothesis", "inc.postmortem_draft", "inc.propose_mitigation"],                                  defaultApproval: "two_person" },
];

// ─── Safety invariants ───────────────────────────────────────────────

export interface SafetyInvariantSpec {
  label: string;
  detail: string;
  enforcedAt: string;
}

export const SAFETY_INVARIANTS: ReadonlyArray<SafetyInvariantSpec> = [
  { label: "Read-only by default",   detail: "No write API is even minted until you explicitly grant write scope.",                                                                                  enforcedAt: "lib/security/apiKeyScope.ts + per-route assertScope()" },
  { label: "Two-person quorum",      detail: "Pipeline gates default to requiredApprovers=2. DB-unique constraint on (snapshotId, approverUserId) blocks double-voting.",                            enforcedAt: "prisma/schema.prisma (EngineerApprovalDecision)" },
  { label: "Rollback verified",      detail: "Every recommendation ships with a pre-validated rollback plan; the apply button is disabled until the rollback validates against a digital twin.",     enforcedAt: "lib/workforce/pipelines/rollbackValidator.ts" },
  { label: "Blast radius capped",    detail: "Each change is risk-tiered against the number of resources it touches; high tiers force extra approvers + slower deploy windows.",                       enforcedAt: "lib/workforce/blastRadius.ts" },
  { label: "Full audit fabric",      detail: "Every action emits a row in the closed-union AuditAction log: actor, action, outcome, correlationId. Best-effort wrapped so observability outages never block business events.", enforcedAt: "lib/audit/secureAudit.ts" },
  { label: "Assume-role model",      detail: "No long-lived access keys stored — workspace assumes a short-lived role you own and can revoke from your provider console.",                              enforcedAt: "lib/cloud/awsAssumeRole.ts + per-provider counterparts" },
  { label: "Closed-union types",     detail: "Scope strings, event kinds, audit actions, approval rules are TypeScript closed unions; typos are compile errors, not runtime denial bugs.",            enforcedAt: "lib/security/apiKeyScope.ts · lib/webhooks/webhookEventKinds.ts · lib/audit/secureAudit.ts" },
  { label: "Tenant isolation",       detail: "Every Prisma read joins on organizationId; cross-tenant lookups collapse to 404 'not_found' so attackers can't probe for cross-org ids.",                enforcedAt: "every app/api/v1/*/route.ts handler" },
  { label: "Idempotent writes",      detail: "Stripe-style Idempotency-Key on every POST that fires side-effects. 24h TTL. Duplicate calls return the cached response with X-VXL-Idempotent-Replay.", enforcedAt: "lib/security/idempotency.ts + idempotencyStore.ts" },
  { label: "Signed webhooks",        detail: "Every outbound delivery carries HMAC-SHA256 and ES256 (JWS) signatures. Public keys rotate at /api/v1/webhooks/jwks (RFC 7517 / 7518 / 7638).",        enforcedAt: "lib/security/webhookEs256.ts + lib/webhooks/signWebhookPayload.ts" },
  { label: "Demo isolation",         detail: "isSandboxWorkspace(orgId) gates every demo data path; assertNotDemoLeak() throws DemoLeakError if a sandbox-only fixture ever touches a real org.",      enforcedAt: "lib/workspace/workspaceKind.ts" },
  { label: "Quota fail-open",        detail: "If the billing DB is slow / unreachable, the v1 quota gate FAILS OPEN — better to over-serve than to lock customers out of their integration.",         enforcedAt: "lib/security/authenticateApiKey.ts" },
];
