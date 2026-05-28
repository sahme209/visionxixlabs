/**
 * Phase 517 — Slack notification persistence + send orchestrator.
 *
 * Two surfaces:
 *   • buildSlackConfigUpsertResponse — operator configures the
 *     org's incoming webhook + filter.
 *   • buildSlackConfigReadResponse / buildSlackLogListResponse —
 *     read paths for the dashboard.
 *   • sendSlackSignalBestEffort — called by other responders when
 *     a critical AGI signal fires. Reads config, filters, formats,
 *     dispatches, persists a SlackNotificationLog. Never throws —
 *     never blocks the source action.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  formatSlackPayload,
  shouldSendSignal,
  dispatchSlackPayload,
  SLACK_SIGNAL_KINDS,
  type SlackConfigView,
  type SlackFetcher,
  type SlackOutcome,
  type SlackSignal,
  type SlackSignalKind,
} from "./slackNotificationEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ConfigRow {
  id: string;
  organizationId: string;
  webhookUrl: string;
  enabledSignalKindsJson: unknown;
  defaultChannel: string | null;
  enabled: boolean;
}

export interface LogRow {
  id: string;
  organizationId: string;
  signalKind: string;
  subjectKind: string | null;
  subjectId: string | null;
  title: string;
  outcome: string;
  httpStatus: number | null;
  errorMessage: string | null;
  payloadJson: unknown;
  generatedAt: Date;
}

export interface SlackRepo {
  slackNotificationConfig: {
    findUnique(args: { where: { organizationId: string } }): Promise<ConfigRow | null>;
    upsert(args: {
      where: { organizationId: string };
      create: {
        organizationId: string;
        webhookUrl: string;
        enabledSignalKindsJson: unknown;
        defaultChannel: string | null;
        enabled: boolean;
      };
      update: {
        webhookUrl: string;
        enabledSignalKindsJson: unknown;
        defaultChannel: string | null;
        enabled: boolean;
      };
    }): Promise<ConfigRow>;
  };
  slackNotificationLog: {
    findMany(args: {
      where: { organizationId: string; signalKind?: string; outcome?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<LogRow[]>;
    create(args: {
      data: {
        organizationId: string;
        signalKind: string;
        subjectKind: string | null;
        subjectId: string | null;
        title: string;
        outcome: string;
        httpStatus: number | null;
        errorMessage: string | null;
        payloadJson: unknown;
      };
    }): Promise<LogRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Project config row into view shape.
   ────────────────────────────────────────────────────────────── */

function projectConfig(row: ConfigRow): SlackConfigView {
  const raw = row.enabledSignalKindsJson;
  let kinds: SlackSignalKind[] | null = null;
  if (Array.isArray(raw)) {
    kinds = raw.filter((k): k is SlackSignalKind =>
      typeof k === "string" && (SLACK_SIGNAL_KINDS as readonly string[]).includes(k),
    );
  }
  return {
    webhookUrl: row.webhookUrl,
    enabled: row.enabled,
    enabledSignalKinds: kinds,
    defaultChannel: row.defaultChannel,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Upsert config.
   ────────────────────────────────────────────────────────────── */

export interface UpsertInput {
  organizationId: string;
  webhookUrl: string;
  enabledSignalKinds?: string[];
  defaultChannel?: string;
  enabled?: boolean;
}

export type UpsertError = "webhook_url_required" | "webhook_url_invalid";

export type UpsertBody =
  | { ok: true; data: { config: SlackConfigView } }
  | { ok: false; error: UpsertError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface UpsertResult { status: number; body: UpsertBody }

const SLACK_URL_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+$/i;

export async function buildSlackConfigUpsertResponse(
  repo: SlackRepo,
  input: UpsertInput,
  opts: { correlationId?: string } = {},
): Promise<UpsertResult> {
  const url = input.webhookUrl?.trim() ?? "";
  if (!url) return { status: 422, body: { ok: false, error: "webhook_url_required" } };
  if (!SLACK_URL_RE.test(url)) {
    return {
      status: 422,
      body: { ok: false, error: "webhook_url_invalid", hint: "webhook URL must look like https://hooks.slack.com/services/..." },
    };
  }

  const kindsCleaned = Array.isArray(input.enabledSignalKinds)
    ? input.enabledSignalKinds.filter((k) => (SLACK_SIGNAL_KINDS as readonly string[]).includes(k))
    : null;

  try {
    const row = await repo.slackNotificationConfig.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        webhookUrl: url,
        enabledSignalKindsJson: kindsCleaned as unknown,
        defaultChannel: input.defaultChannel?.trim() || null,
        enabled: input.enabled !== false,
      },
      update: {
        webhookUrl: url,
        enabledSignalKindsJson: kindsCleaned as unknown,
        defaultChannel: input.defaultChannel?.trim() || null,
        enabled: input.enabled !== false,
      },
    });
    return { status: 200, body: { ok: true, data: { config: projectConfig(row) } } };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending", hint: "SlackNotificationConfig table needs Phase 517 migration." } };
    }
    return { status: 500, body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) } };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Read config.
   ────────────────────────────────────────────────────────────── */

export type ReadBody =
  | { ok: true; data: { config: SlackConfigView | null } }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ReadResult { status: number; body: ReadBody }

export async function buildSlackConfigReadResponse(
  repo: SlackRepo,
  organizationId: string,
  opts: { correlationId?: string } = {},
): Promise<ReadResult> {
  try {
    const row = await repo.slackNotificationConfig.findUnique({ where: { organizationId } });
    if (!row) return { status: 200, body: { ok: true, data: { config: null } } };
    const projected = projectConfig(row);
    // Mask the webhook URL for safe display: keep prefix + last 4 chars.
    const masked = projected.webhookUrl.length > 12
      ? `${projected.webhookUrl.slice(0, 30)}…${projected.webhookUrl.slice(-4)}`
      : projected.webhookUrl;
    return {
      status: 200,
      body: { ok: true, data: { config: { ...projected, webhookUrl: masked } } },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending", hint: "SlackNotificationConfig table needs Phase 517 migration." } };
    }
    return { status: 500, body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) } };
  }
}

/* ──────────────────────────────────────────────────────────────────
   List delivery log.
   ────────────────────────────────────────────────────────────── */

export interface LogView {
  id: string;
  signalKind: string;
  subjectKind: string | null;
  subjectId: string | null;
  title: string;
  outcome: SlackOutcome | "unknown";
  httpStatus: number | null;
  errorMessage: string | null;
  generatedAtIso: string;
}

export type LogListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        entries: LogView[];
        summary: {
          total: number;
          sent: number;
          errored: number;
          skipped: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface LogListResult { status: number; body: LogListBody }

function projectLog(r: LogRow): LogView {
  const isKnownOutcome = (["sent", "skipped_not_configured", "skipped_filtered", "error"] as readonly string[]).includes(r.outcome);
  return {
    id: r.id,
    signalKind: r.signalKind,
    subjectKind: r.subjectKind,
    subjectId: r.subjectId,
    title: r.title,
    outcome: isKnownOutcome ? (r.outcome as SlackOutcome) : "unknown",
    httpStatus: r.httpStatus,
    errorMessage: r.errorMessage,
    generatedAtIso: r.generatedAt.toISOString(),
  };
}

export async function buildSlackLogListResponse(
  repo: SlackRepo,
  input: { organizationId: string; signalKind?: string; outcome?: string },
  opts: { now?: Date; correlationId?: string } = {},
): Promise<LogListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; signalKind?: string; outcome?: string } = { organizationId: input.organizationId };
    if (input.signalKind) where.signalKind = input.signalKind;
    if (input.outcome) where.outcome = input.outcome;
    const rows = await repo.slackNotificationLog.findMany({ where, orderBy: { generatedAt: "desc" }, take: 200 });
    const entries = rows.map(projectLog);
    let sent = 0, errored = 0, skipped = 0;
    for (const e of entries) {
      if (e.outcome === "sent") sent += 1;
      else if (e.outcome === "error") errored += 1;
      else if (e.outcome === "skipped_filtered" || e.outcome === "skipped_not_configured") skipped += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          entries,
          summary: { total: entries.length, sent, errored, skipped },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending", hint: "SlackNotificationLog table needs Phase 517 migration." } };
    }
    return { status: 500, body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) } };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Best-effort send — called by other AGI responders.
   ────────────────────────────────────────────────────────────── */

export interface SendInput {
  organizationId: string;
  signal: SlackSignal;
}

/**
 * Read config, filter, format, dispatch, log. Returns the final
 * outcome. Never throws — caller can ignore the return value if
 * they prefer.
 */
export async function sendSlackSignalBestEffort(
  repo: SlackRepo,
  input: SendInput,
  fetcher: SlackFetcher,
): Promise<SlackOutcome> {
  try {
    const row = await safeFindConfig(repo, input.organizationId);
    const config = row ? projectConfig(row) : null;
    const decision = shouldSendSignal(input.signal, config);

    if (!decision.shouldSend) {
      const outcome: SlackOutcome =
        decision.reason === "no_config" || decision.reason === "config_disabled" || decision.reason === "missing_webhook_url"
          ? "skipped_not_configured"
          : "skipped_filtered";
      await safeLog(repo, {
        organizationId: input.organizationId,
        signalKind: input.signal.kind,
        subjectKind: input.signal.subjectKind ?? null,
        subjectId: input.signal.subjectId ?? null,
        title: input.signal.title,
        outcome,
        httpStatus: null,
        errorMessage: decision.reason,
        payloadJson: { reason: decision.reason } as unknown,
      });
      return outcome;
    }

    const payload = formatSlackPayload(input.signal, { channel: config?.defaultChannel ?? undefined });
    const dispatchResult = await dispatchSlackPayload(payload, config!.webhookUrl, fetcher);
    await safeLog(repo, {
      organizationId: input.organizationId,
      signalKind: input.signal.kind,
      subjectKind: input.signal.subjectKind ?? null,
      subjectId: input.signal.subjectId ?? null,
      title: input.signal.title,
      outcome: dispatchResult.outcome,
      httpStatus: dispatchResult.httpStatus ?? null,
      errorMessage: dispatchResult.errorMessage ?? null,
      payloadJson: payload as unknown,
    });
    return dispatchResult.outcome;
  } catch {
    // Slack send must never break the caller.
    return "error";
  }
}

async function safeFindConfig(repo: SlackRepo, organizationId: string): Promise<ConfigRow | null> {
  try { return await repo.slackNotificationConfig.findUnique({ where: { organizationId } }); }
  catch (err) { if (isMissingTable(err)) return null; throw err; }
}

async function safeLog(repo: SlackRepo, data: {
  organizationId: string;
  signalKind: string;
  subjectKind: string | null;
  subjectId: string | null;
  title: string;
  outcome: string;
  httpStatus: number | null;
  errorMessage: string | null;
  payloadJson: unknown;
}): Promise<void> {
  try { await repo.slackNotificationLog.create({ data }); }
  catch { /* swallow — log persistence never blocks */ }
}
