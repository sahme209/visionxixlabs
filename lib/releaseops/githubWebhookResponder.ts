/**
 * Phase 497 — GitHub webhook receiver.
 *
 * Pure surface (no Prisma import). HMAC verification + payload
 * parsing + idempotent dispatch. The route handler glues this to
 * `req.text()` + signature header.
 *
 * Provider scope: "github" only in this phase. The repo lookup
 * resolves `repository.full_name` (e.g. "acme/checkout") to a known
 * Repository row — if none exists for the org, the delivery is
 * accepted but marked "ignored" (no panic; user can register the
 * repo and replay).
 */

import crypto from "node:crypto";
import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Signature verification.
   ────────────────────────────────────────────────────────────── */

export interface SignatureCheckResult {
  ok: boolean;
  reason?: "missing_header" | "wrong_format" | "mismatch";
}

/**
 * Verify the `X-Hub-Signature-256` header against the raw request body.
 * Header format: "sha256=<hex>". Pure — does no I/O.
 */
export function verifyGitHubSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): SignatureCheckResult {
  if (!header) return { ok: false, reason: "missing_header" };
  if (!header.startsWith("sha256=")) return { ok: false, reason: "wrong_format" };
  const expected = header.slice("sha256=".length);
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  if (expected.length !== computed.length) return { ok: false, reason: "mismatch" };
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(computed, "hex");
  if (a.length !== b.length) return { ok: false, reason: "mismatch" };
  return crypto.timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, reason: "mismatch" };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface RepoLookupRow {
  id: string;
  organizationId: string;
  remoteOwner: string;
  remoteName: string;
}

export interface DeliveryRow {
  id: string;
  organizationId: string;
  provider: string;
  deliveryId: string;
  eventKind: string;
  eventAction: string | null;
  outcome: string;
  summary: string;
  receivedAt: Date;
}

export interface GithubWebhookRepo {
  repository: {
    findFirst(args: {
      where: { provider: string; remoteOwner: string; remoteName: string };
    }): Promise<RepoLookupRow | null>;
  };
  inboundWebhookDelivery: {
    findUnique(args: {
      where: { provider_deliveryId: { provider: string; deliveryId: string } };
    }): Promise<DeliveryRow | null>;
    create(args: {
      data: {
        organizationId: string;
        provider: string;
        deliveryId: string;
        eventKind: string;
        eventAction: string | null;
        outcome: string;
        summary: string;
        payloadJson: unknown;
      };
    }): Promise<DeliveryRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Payload parsing.
   ────────────────────────────────────────────────────────────── */

interface ParsedPayload {
  fullName: string | null;
  action: string | null;
  // For summary lines, opportunistically pull commonly-useful fields.
  prNumber?: number | null;
  prTitle?: string | null;
  releaseTag?: string | null;
  workflowName?: string | null;
  workflowConclusion?: string | null;
  ref?: string | null;
}

function parsePayload(eventKind: string, payload: unknown): ParsedPayload {
  if (!payload || typeof payload !== "object") {
    return { fullName: null, action: null };
  }
  const p = payload as Record<string, unknown>;
  const repository = p.repository as Record<string, unknown> | undefined;
  const fullName = repository && typeof repository.full_name === "string" ? repository.full_name : null;
  const action = typeof p.action === "string" ? p.action : null;
  const out: ParsedPayload = { fullName, action };

  if (eventKind === "pull_request") {
    const pr = p.pull_request as Record<string, unknown> | undefined;
    if (pr) {
      out.prNumber = typeof pr.number === "number" ? pr.number : null;
      out.prTitle = typeof pr.title === "string" ? pr.title : null;
    }
  }
  if (eventKind === "release") {
    const rel = p.release as Record<string, unknown> | undefined;
    if (rel && typeof rel.tag_name === "string") out.releaseTag = rel.tag_name;
  }
  if (eventKind === "workflow_run") {
    const wf = p.workflow_run as Record<string, unknown> | undefined;
    if (wf) {
      out.workflowName = typeof wf.name === "string" ? wf.name : null;
      out.workflowConclusion = typeof wf.conclusion === "string" ? wf.conclusion : null;
    }
  }
  if (eventKind === "push") {
    out.ref = typeof p.ref === "string" ? p.ref : null;
  }
  return out;
}

function splitFullName(fullName: string): { owner: string; name: string } | null {
  const idx = fullName.indexOf("/");
  if (idx <= 0 || idx >= fullName.length - 1) return null;
  return { owner: fullName.slice(0, idx), name: fullName.slice(idx + 1) };
}

function summaryFor(eventKind: string, parsed: ParsedPayload): string {
  const repoLabel = parsed.fullName ?? "(unknown repo)";
  if (eventKind === "pull_request") {
    return `${repoLabel} · PR #${parsed.prNumber ?? "?"} ${parsed.action ?? ""} · ${parsed.prTitle ?? ""}`.trim();
  }
  if (eventKind === "release") {
    return `${repoLabel} · release ${parsed.releaseTag ?? "?"} ${parsed.action ?? ""}`.trim();
  }
  if (eventKind === "workflow_run") {
    return `${repoLabel} · workflow ${parsed.workflowName ?? "?"} · ${parsed.workflowConclusion ?? parsed.action ?? "?"}`.trim();
  }
  if (eventKind === "push") {
    return `${repoLabel} · push ${parsed.ref ?? ""}`.trim();
  }
  return `${repoLabel} · ${eventKind}${parsed.action ? ` · ${parsed.action}` : ""}`;
}

/* ──────────────────────────────────────────────────────────────────
   Dispatch.
   ────────────────────────────────────────────────────────────── */

export interface DispatchInput {
  deliveryId: string;
  eventKind: string;
  payload: unknown;
}

export type DispatchError =
  | "delivery_id_required"
  | "event_kind_required"
  | "unsupported_event";

export const SUPPORTED_EVENTS = [
  "ping",
  "push",
  "pull_request",
  "release",
  "workflow_run",
] as const;
export type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];

function isSupported(s: string): s is SupportedEvent {
  return (SUPPORTED_EVENTS as readonly string[]).includes(s);
}

export type GithubWebhookBody =
  | {
      ok: true;
      data: {
        deliveryId: string;
        idempotent: boolean;
        outcome: "accepted" | "ignored";
        summary: string;
      };
    }
  | { ok: false; error: DispatchError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface DispatchResult { status: number; body: GithubWebhookBody }

export async function dispatchGitHubWebhook(
  repo: GithubWebhookRepo,
  input: DispatchInput,
  opts: { correlationId?: string } = {},
): Promise<DispatchResult> {
  if (!input.deliveryId) {
    return { status: 400, body: { ok: false, error: "delivery_id_required" } };
  }
  if (!input.eventKind) {
    return { status: 400, body: { ok: false, error: "event_kind_required" } };
  }
  if (!isSupported(input.eventKind)) {
    return {
      status: 202,
      body: { ok: false, error: "unsupported_event", hint: `Event "${input.eventKind}" is not handled — delivery acknowledged but not persisted.` },
    };
  }

  try {
    // Idempotency check.
    const existing = await repo.inboundWebhookDelivery.findUnique({
      where: { provider_deliveryId: { provider: "github", deliveryId: input.deliveryId } },
    });
    if (existing) {
      return {
        status: 200,
        body: {
          ok: true,
          data: {
            deliveryId: input.deliveryId,
            idempotent: true,
            outcome: existing.outcome === "ignored" ? "ignored" : "accepted",
            summary: existing.summary,
          },
        },
      };
    }

    const parsed = parsePayload(input.eventKind, input.payload);
    // Resolve org via repository lookup. ping events come in with no
    // repository — accept them globally with a "system" org so the
    // operator can confirm the hook works before any repo is registered.
    let organizationId = "system";
    let outcome: "accepted" | "ignored" = "accepted";

    if (input.eventKind === "ping") {
      // ping has full_name in payload.repository if hook is repo-scoped.
      if (parsed.fullName) {
        const parts = splitFullName(parsed.fullName);
        if (parts) {
          const row = await repo.repository.findFirst({
            where: { provider: "github", remoteOwner: parts.owner, remoteName: parts.name },
          });
          if (row) organizationId = row.organizationId;
          else outcome = "ignored";
        }
      }
    } else {
      if (!parsed.fullName) {
        outcome = "ignored";
      } else {
        const parts = splitFullName(parsed.fullName);
        if (!parts) {
          outcome = "ignored";
        } else {
          const row = await repo.repository.findFirst({
            where: { provider: "github", remoteOwner: parts.owner, remoteName: parts.name },
          });
          if (!row) outcome = "ignored";
          else organizationId = row.organizationId;
        }
      }
    }

    const summary = summaryFor(input.eventKind, parsed) || `${input.eventKind} delivery`;

    await repo.inboundWebhookDelivery.create({
      data: {
        organizationId,
        provider: "github",
        deliveryId: input.deliveryId,
        eventKind: input.eventKind,
        eventAction: parsed.action,
        outcome,
        summary,
        payloadJson: input.payload as object,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: { deliveryId: input.deliveryId, idempotent: false, outcome, summary },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "WebhookDelivery table needs Phase 497 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   List responder — for the dashboard inbox.
   ────────────────────────────────────────────────────────────── */

export interface DeliveryView {
  id: string;
  provider: string;
  deliveryId: string;
  eventKind: string;
  eventAction: string | null;
  outcome: "accepted" | "ignored" | "error" | "unknown";
  summary: string;
  receivedAtIso: string;
}

export interface DeliveryListRepo {
  inboundWebhookDelivery: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { receivedAt: "desc" };
      take?: number;
    }): Promise<DeliveryRow[]>;
  };
}

function projectDelivery(r: DeliveryRow): DeliveryView {
  const outcome = r.outcome === "accepted" || r.outcome === "ignored" || r.outcome === "error" ? r.outcome : "unknown";
  return {
    id: r.id,
    provider: r.provider,
    deliveryId: r.deliveryId,
    eventKind: r.eventKind,
    eventAction: r.eventAction,
    outcome,
    summary: r.summary,
    receivedAtIso: r.receivedAt.toISOString(),
  };
}

export type DeliveryListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        deliveries: DeliveryView[];
        summary: {
          total: number;
          accepted: number;
          ignored: number;
          errored: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: DeliveryListBody }

export async function buildWebhookDeliveryListResponse(
  repo: DeliveryListRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const rows = await repo.inboundWebhookDelivery.findMany({
      where: { organizationId },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
    const deliveries = rows.map(projectDelivery);
    let accepted = 0, ignored = 0, errored = 0;
    for (const d of deliveries) {
      if (d.outcome === "accepted") accepted += 1;
      else if (d.outcome === "ignored") ignored += 1;
      else if (d.outcome === "error") errored += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          deliveries,
          summary: { total: deliveries.length, accepted, ignored, errored },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "WebhookDelivery table needs Phase 497 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
