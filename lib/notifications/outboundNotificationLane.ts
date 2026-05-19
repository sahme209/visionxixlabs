/**
 * Outbound Notification Lane.
 *
 * Closes the AGI ↔ human loop. When the autonomy loop halts at a
 * `needs_human` gate or surfaces a critical signal, this lane
 * **proactively notifies humans** through their existing channels
 * (Slack, Microsoft Teams, generic webhook, email). The loop is no
 * longer dependent on the operator opening the dashboard.
 *
 * Hard rules:
 *   - Every send is gated by an env opt-in per destination.
 *   - Payloads pass through redactPayload before transmit — secrets
 *     never leak even if the autonomy loop's reasoning mentioned one.
 *   - Each notification carries a stable dedupeKey so re-firing the
 *     same human-needs decision doesn't spam the channel.
 *   - The lane NEVER triggers a remediation — it just announces.
 *     Operators click the safeNextAction route to act.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { redactPayload } from "@/lib/api/redaction";
import { persistOutboundNotificationRecord } from "./outboundNotificationStore";

// ---------------------------------------------------------------------------
// Typed contract
// ---------------------------------------------------------------------------

export type OutboundChannel = "slack" | "microsoft_teams" | "generic_webhook" | "email";

export type OutboundSeverity = "critical" | "high" | "medium" | "low" | "info";

export type OutboundNotificationKind =
  | "autonomy_halt_needs_human"
  | "autonomy_halt_unsafe"
  | "autonomy_halt_policy"
  | "approval_packet_ready"
  | "critical_telemetry_signal"
  | "critical_incident"
  | "budget_threshold_breach"
  | "release_blocker"
  | "cycle_summary";

export interface OutboundNotification {
  /** Stable dedupe key — sending the same key twice within DEDUPE_WINDOW
   *  is a no-op. Use linked-entity ids for stability. */
  dedupeKey: string;
  kind: OutboundNotificationKind;
  severity: OutboundSeverity;
  /** Single-line headline. */
  headline: string;
  /** Slack-style markdown body (Slack mrkdwn + Teams MessageCard both
   *  treat \n + bold via *...* / **...** identically enough). */
  body: string;
  /** Tenant id so multi-tenant channels can split routing later. */
  tenantId: string;
  /** Operator-actionable route. */
  safeNextAction?: { label: string; href: string };
  /** Evidence refs the operator can verify. */
  evidenceRefs: string[];
}

export interface OutboundSendResult {
  ok: boolean;
  channelsAttempted: OutboundChannel[];
  channelsSucceeded: OutboundChannel[];
  channelsSkipped: { channel: OutboundChannel; reason: string }[];
  reason?: string;
  /** Wall-clock cost. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Dedupe window — 10 minutes is enough to suppress per-cycle re-fires
// from the */15 scheduler.
// ---------------------------------------------------------------------------

const DEDUPE_WINDOW_MS = 10 * 60_000;
const RECENT_SENDS: Map<string, number> = new Map();

function isDeduped(key: string): boolean {
  const last = RECENT_SENDS.get(key);
  if (!last) return false;
  return Date.now() - last < DEDUPE_WINDOW_MS;
}

function markSent(key: string): void {
  RECENT_SENDS.set(key, Date.now());
  // Trim — never more than 500 keys.
  if (RECENT_SENDS.size > 500) {
    const oldest = Array.from(RECENT_SENDS.entries()).sort((a, b) => a[1] - b[1])[0]?.[0];
    if (oldest) RECENT_SENDS.delete(oldest);
  }
}

export function clearOutboundDedupe(): number {
  const n = RECENT_SENDS.size;
  RECENT_SENDS.clear();
  return n;
}

// ---------------------------------------------------------------------------
// Public entry — send to every configured channel
// ---------------------------------------------------------------------------

export async function sendOutboundNotification(n: OutboundNotification): Promise<OutboundSendResult> {
  const start = Date.now();
  const env = loadAppEnv();

  if (isDeduped(n.dedupeKey)) {
    const result: OutboundSendResult = {
      ok: true,
      channelsAttempted: [],
      channelsSucceeded: [],
      channelsSkipped: [{ channel: "slack", reason: "deduped" }],
      reason: "deduped",
      durationMs: Date.now() - start,
    };
    // Best-effort durability write — never blocks the send path.
    void persistOutboundNotificationRecord(n, result, "deduped");
    return result;
  }

  const redacted = redactPayload(n);
  const attempted: OutboundChannel[] = [];
  const succeeded: OutboundChannel[] = [];
  const skipped: { channel: OutboundChannel; reason: string }[] = [];

  // Slack
  if (env.slackWebhookUrl) {
    attempted.push("slack");
    const ok = await postJson(env.slackWebhookUrl, buildSlackPayload(redacted));
    if (ok) succeeded.push("slack");
    else skipped.push({ channel: "slack", reason: "post_failed" });
  } else {
    skipped.push({ channel: "slack", reason: "SLACK_WEBHOOK_URL not set" });
  }

  // Microsoft Teams
  if (env.teamsWebhookUrl) {
    attempted.push("microsoft_teams");
    const ok = await postJson(env.teamsWebhookUrl, buildTeamsPayload(redacted));
    if (ok) succeeded.push("microsoft_teams");
    else skipped.push({ channel: "microsoft_teams", reason: "post_failed" });
  } else {
    skipped.push({ channel: "microsoft_teams", reason: "TEAMS_WEBHOOK_URL not set" });
  }

  // Generic webhook (signed HMAC if OUTBOUND_WEBHOOK_SECRET set)
  if (env.outboundWebhookUrl) {
    attempted.push("generic_webhook");
    const ok = await postSignedJson(env.outboundWebhookUrl, redacted, env.outboundWebhookSecret);
    if (ok) succeeded.push("generic_webhook");
    else skipped.push({ channel: "generic_webhook", reason: "post_failed" });
  } else {
    skipped.push({ channel: "generic_webhook", reason: "OUTBOUND_WEBHOOK_URL not set" });
  }

  // Email — declared but actual SMTP wiring is a follow-up
  skipped.push({ channel: "email", reason: "email transport pending — Phase 56b" });

  if (succeeded.length > 0) markSent(n.dedupeKey);

  const result: OutboundSendResult = {
    ok: succeeded.length > 0,
    channelsAttempted: attempted,
    channelsSucceeded: succeeded,
    channelsSkipped: skipped,
    reason: succeeded.length === 0 ? "no_channels_succeeded" : undefined,
    durationMs: Date.now() - start,
  };
  const outcome = succeeded.length > 0
    ? "ok"
    : attempted.length === 0
      ? "skipped"
      : "failed";
  void persistOutboundNotificationRecord(n, result, outcome);
  return result;
}

// ---------------------------------------------------------------------------
// Per-channel payload builders
// ---------------------------------------------------------------------------

function buildSlackPayload(n: OutboundNotification): unknown {
  const tone = severityEmoji(n.severity);
  return {
    text: `${tone} *${n.headline}*`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${tone} ${n.headline}`.slice(0, 150) },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: n.body.slice(0, 2900) },
      },
      ...(n.safeNextAction
        ? [{
            type: "actions",
            elements: [{
              type: "button",
              text: { type: "plain_text", text: n.safeNextAction.label.slice(0, 70) },
              url: n.safeNextAction.href,
              style: "primary",
            }],
          }]
        : []),
      {
        type: "context",
        elements: [{
          type: "mrkdwn",
          text: `_kind: ${n.kind} · severity: ${n.severity} · tenant: ${n.tenantId}_`,
        }],
      },
    ],
  };
}

function buildTeamsPayload(n: OutboundNotification): unknown {
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: severityColor(n.severity),
    summary: n.headline.slice(0, 150),
    title: `${severityEmoji(n.severity)} ${n.headline}`,
    text: n.body,
    potentialAction: n.safeNextAction
      ? [{
          "@type": "OpenUri",
          name: n.safeNextAction.label,
          targets: [{ os: "default", uri: n.safeNextAction.href }],
        }]
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// HTTP transport
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 8_000;

async function postJson(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      DEFAULT_TIMEOUT_MS,
      "outbound.post",
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function postSignedJson(url: string, body: unknown, secret: string | undefined): Promise<boolean> {
  try {
    const raw = JSON.stringify(body);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (secret) {
      const { createHmac } = await import("crypto");
      const sig = createHmac("sha256", secret).update(raw).digest("hex");
      headers["x-axiom-signature"] = `sha256=${sig}`;
    }
    const res = await withTimeout(
      fetch(url, { method: "POST", headers, body: raw }),
      DEFAULT_TIMEOUT_MS,
      "outbound.post_signed",
    );
    return res.ok;
  } catch {
    return false;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

function severityEmoji(s: OutboundSeverity): string {
  switch (s) {
    case "critical": return ":rotating_light:";
    case "high":     return ":warning:";
    case "medium":   return ":large_yellow_circle:";
    case "low":      return ":large_blue_circle:";
    case "info":     return ":information_source:";
  }
}

function severityColor(s: OutboundSeverity): string {
  switch (s) {
    case "critical": return "ef4444";
    case "high":     return "f59e0b";
    case "medium":   return "06b6d4";
    case "low":      return "10b981";
    case "info":     return "6b7280";
  }
}
