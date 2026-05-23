/**
 * visionxixlabs.ts — Phase 399.
 *
 * Drop-in TypeScript client for the VisionXIXLabs v1 API.
 * Zero external dependencies — runs on Node 18+, Bun, Deno, Cloudflare
 * Workers, Vercel Edge runtime. Uses only the global `fetch` and the
 * Web Crypto API.
 *
 * Usage:
 *
 *   import { VisionXIXLabs, verifyWebhookSignature } from "./visionxixlabs";
 *
 *   const client = new VisionXIXLabs({ apiKey: process.env.VXL_API_KEY! });
 *
 *   // 1. 3-line integration test:
 *   const me = await client.whoami();
 *   console.log(`Signed in as ${me.organization.id} on ${me.organization.planTier}`);
 *
 *   // 2. Read the release-gate verdict (CI deploy gate):
 *   const gate = await client.releaseGate();
 *   if (!gate.gate?.passed) process.exit(1);
 *
 *   // 3. Trigger a coding run:
 *   const run = await client.startCodingRun({
 *     instruction: "Add a /healthz route",
 *     repoRef: "acme/example",
 *     branchHint: "main",
 *   });
 *
 *   // 4. Verify a webhook delivery:
 *   const ok = await verifyWebhookSignature({
 *     rawBody, signatureHex, timestampSec, secret,
 *   });
 */

export interface VisionXIXLabsOptions {
  apiKey: string;
  baseUrl?: string;                       // default https://visionxixlabs.com
  fetchImpl?: typeof fetch;               // override for tests
  timeoutMs?: number;                     // default 30s
}

export interface WhoamiResponse {
  ok: true;
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
}

export interface ReleaseGateResponse {
  ok: true;
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
}

export interface StartRunResponse {
  ok: true;
  runId: string;
  correlationId: string;
  status: string;
  pollUrl: string;
}

export interface PipelineRunResponse {
  ok: true;
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
}

export interface DecideApprovalInput {
  decision: "approved" | "rejected";
  reason?: string;
  /** Override the vote actor; defaults to `api_key:<keyId>`. */
  approverUserId?: string;
}

export interface DecideApprovalResponse {
  ok: true;
  runId: string;
  approvalId: string;
  vote: "approved" | "rejected";
  snapshotStatus: "pending" | "approved" | "rejected" | "expired";
  approvedCount: number;
  rejectedCount: number;
  requiredApprovers: number;
  /** True only when the projected quorum tipped this call to terminal. */
  isTerminal: boolean;
  decidedAt: string | null;
  stageTransitioned: boolean;
}

export interface StartCodingRunInput {
  instruction: string;
  repoRef: string;
  branchHint?: string;
  metadata?: Record<string, string>;
  /**
   * Optional Stripe-style idempotency key. When set, a duplicate
   * call with the same key + body returns the cached response
   * instead of firing a second pipeline run. 24h TTL.
   */
  idempotencyKey?: string;
}

export class VXLApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | null;
  constructor(args: { status: number; code: string; message: string; retryAfterSeconds: number | null }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.retryAfterSeconds = args.retryAfterSeconds;
    this.name = "VXLApiError";
  }
}

export class VisionXIXLabs {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: VisionXIXLabsOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://visionxixlabs.com").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  whoami(): Promise<WhoamiResponse> {
    return this.get<WhoamiResponse>("/api/v1/whoami");
  }

  releaseGate(): Promise<ReleaseGateResponse> {
    return this.get<ReleaseGateResponse>("/api/v1/release-gate");
  }

  pipelineRun(runId: string): Promise<PipelineRunResponse> {
    return this.get<PipelineRunResponse>(`/api/v1/pipelines/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * Vote on a pipeline run currently paused at an awaiting_approval
   * stage. Pipeline gates default to requiredApprovers=2 — a single
   * call records ONE vote; a second distinct approver still has to
   * vote before the gate tips and the run advances.
   *
   * Required scope: pipeline:trigger.
   */
  decideApproval(runId: string, input: DecideApprovalInput): Promise<DecideApprovalResponse> {
    return this.post<DecideApprovalResponse>(
      `/api/v1/pipelines/runs/${encodeURIComponent(runId)}/decide`,
      {
        decision: input.decision,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.approverUserId ? { approverUserId: input.approverUserId } : {}),
      },
    );
  }

  startCodingRun(input: StartCodingRunInput): Promise<StartRunResponse> {
    return this.post<StartRunResponse>(
      "/api/v1/pipelines/runs",
      {
        pipelineId: "ai_coding",
        instruction: input.instruction,
        repoRef: input.repoRef,
        ...(input.branchHint ? { branchHint: input.branchHint } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
      input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : undefined,
    );
  }

  // ---------------------------------------------------------------- HTTP

  private async get<T>(path: string): Promise<T> {
    return this.execute<T>("GET", path);
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    return this.execute<T>("POST", path, JSON.stringify(body), extraHeaders);
  }

  private async execute<T>(
    method: "GET" | "POST",
    path: string,
    body?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "User-Agent": "VisionXIXLabs-TS/1.0",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(extraHeaders ?? {}),
        },
        body,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        let code = "http_error";
        let message = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          if (typeof parsed.error === "string") code = parsed.error;
          if (typeof parsed.message === "string") message = parsed.message;
        } catch { /* leave defaults */ }
        const retryAfterRaw = res.headers.get("retry-after");
        const retryAfterSeconds = retryAfterRaw ? parseInt(retryAfterRaw, 10) : null;
        throw new VXLApiError({
          status: res.status,
          code,
          message,
          retryAfterSeconds: Number.isFinite(retryAfterSeconds!) ? retryAfterSeconds : null,
        });
      }
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ------------------------ webhook signature verification ------------------------

export interface VerifyWebhookInput {
  /** Raw request body as the integrator received it. */
  rawBody: string;
  /** Value of the `X-VXL-Signature` header. */
  signatureHex: string;
  /** Value of the `X-VXL-Timestamp` header, parsed to a number. */
  timestampSec: number;
  /** Secret that was minted when you registered this endpoint. */
  secret: string;
  /** Replay-protection window. Default ±5 minutes. */
  toleranceSec?: number;
  /** Server time for the comparison. Default Date.now(). */
  now?: Date;
}

/**
 * Verify the HMAC-SHA256 signature on an inbound webhook delivery.
 *
 * Returns true only when both the signature matches AND the timestamp
 * is within the tolerance window. Constant-time comparison.
 *
 * Uses the Web Crypto API (available in Node 18+, browsers, Deno, Bun,
 * Cloudflare Workers, Vercel Edge). For older Node versions, replace
 * with the `node:crypto` `createHmac` API.
 */
export async function verifyWebhookSignature(input: VerifyWebhookInput): Promise<boolean> {
  const now = input.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const tolerance = input.toleranceSec ?? 300;
  if (Math.abs(nowSec - input.timestampSec) > tolerance) return false;

  const payload = `${input.timestampSec}.${input.rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqual(sigHex, input.signatureHex.toLowerCase());
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
