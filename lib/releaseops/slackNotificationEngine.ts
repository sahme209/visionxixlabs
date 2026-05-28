/**
 * Phase 517 — Slack outbound for critical AGI signals.
 *
 * Pure formatter + dispatch contract. The formatter turns a
 * structured signal into a Slack incoming-webhook payload. The
 * dispatcher (caller's responsibility) sends the payload to the
 * configured webhook URL and persists a SlackNotificationLog row.
 *
 * Everything is best-effort. Slack send failures never block the
 * source action.
 */

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const SLACK_SIGNAL_KINDS = [
  "council_critical",
  "triage_auto_escalate",
  "learning_loop_signal",
  "remediation_p0",
  "proactive_suggestion_batch",
] as const;
export type SlackSignalKind = (typeof SLACK_SIGNAL_KINDS)[number];

export const SLACK_OUTCOMES = ["sent", "skipped_not_configured", "skipped_filtered", "error"] as const;
export type SlackOutcome = (typeof SLACK_OUTCOMES)[number];

export function isSlackSignalKind(s: string): s is SlackSignalKind {
  return (SLACK_SIGNAL_KINDS as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Signal payload.
   ────────────────────────────────────────────────────────────── */

export interface SlackSignal {
  kind: SlackSignalKind;
  title: string;
  /** One-line summary. */
  summary: string;
  /** Optional detail line — included as a smaller field on the Slack message. */
  detail?: string;
  /** Optional deep-link back into the dashboard. */
  dashboardUrl?: string;
  /** Closed-union severity: low | medium | high | critical. */
  severity: "low" | "medium" | "high" | "critical";
  subjectKind?: string;
  subjectId?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Pure formatter — turns a signal into Slack incoming-webhook JSON.
   ────────────────────────────────────────────────────────────── */

const SEVERITY_EMOJI: Record<SlackSignal["severity"], string> = {
  critical: ":rotating_light:",
  high:     ":warning:",
  medium:   ":large_yellow_circle:",
  low:      ":large_blue_circle:",
};

const KIND_PREFIX: Record<SlackSignalKind, string> = {
  council_critical:           "AGI council",
  triage_auto_escalate:       "Triage auto-escalate",
  learning_loop_signal:       "Learning loop",
  remediation_p0:             "Remediation",
  proactive_suggestion_batch: "AGI suggestions",
};

export interface SlackPayload {
  text: string;
  blocks: Array<Record<string, unknown>>;
  channel?: string;
}

export function formatSlackPayload(
  signal: SlackSignal,
  opts: { channel?: string } = {},
): SlackPayload {
  const emoji = SEVERITY_EMOJI[signal.severity];
  const prefix = KIND_PREFIX[signal.kind];
  const headline = `${emoji} ${prefix}: ${signal.title}`;
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${headline}*\n${signal.summary}`,
      },
    },
  ];
  if (signal.detail) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `_${signal.detail}_` },
    });
  }
  // Context line — severity, subject, deep link.
  const contextElements: Array<Record<string, unknown>> = [
    { type: "mrkdwn", text: `*severity*: ${signal.severity}` },
  ];
  if (signal.subjectKind && signal.subjectId) {
    contextElements.push({ type: "mrkdwn", text: `*${signal.subjectKind}*: \`${signal.subjectId}\`` });
  }
  if (signal.dashboardUrl) {
    contextElements.push({ type: "mrkdwn", text: `<${signal.dashboardUrl}|Open in dashboard>` });
  }
  blocks.push({ type: "context", elements: contextElements });

  const payload: SlackPayload = {
    // Fallback plain-text used by mobile + accessibility surfaces.
    text: headline,
    blocks,
  };
  if (opts.channel) payload.channel = opts.channel;
  return payload;
}

/* ──────────────────────────────────────────────────────────────────
   Filter — should this signal be sent?
   ────────────────────────────────────────────────────────────── */

export interface SlackConfigView {
  webhookUrl: string;
  enabled: boolean;
  enabledSignalKinds: SlackSignalKind[] | null; // null = all
  defaultChannel: string | null;
}

export interface FilterDecision {
  shouldSend: boolean;
  reason: "ok" | "no_config" | "config_disabled" | "kind_filtered" | "missing_webhook_url";
}

export function shouldSendSignal(
  signal: SlackSignal,
  config: SlackConfigView | null,
): FilterDecision {
  if (!config) return { shouldSend: false, reason: "no_config" };
  if (!config.enabled) return { shouldSend: false, reason: "config_disabled" };
  if (!config.webhookUrl) return { shouldSend: false, reason: "missing_webhook_url" };
  // If enabledSignalKinds is null, treat as "all critical kinds".
  if (config.enabledSignalKinds === null) return { shouldSend: true, reason: "ok" };
  if (config.enabledSignalKinds.length === 0) return { shouldSend: true, reason: "ok" };
  if (config.enabledSignalKinds.includes(signal.kind)) return { shouldSend: true, reason: "ok" };
  return { shouldSend: false, reason: "kind_filtered" };
}

/* ──────────────────────────────────────────────────────────────────
   Dispatcher result (for logging).
   ────────────────────────────────────────────────────────────── */

export interface DispatchAttempt {
  payload: SlackPayload;
  outcome: SlackOutcome;
  httpStatus?: number;
  errorMessage?: string;
}

/**
 * Perform the actual HTTP POST to the Slack incoming-webhook URL.
 * Pure with respect to its dependencies — `fetcher` is injected so
 * tests can mock it.
 *
 * Slack's incoming-webhook treats any 2xx as success.
 */
export type SlackFetcher = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

export async function dispatchSlackPayload(
  payload: SlackPayload,
  webhookUrl: string,
  fetcher: SlackFetcher,
): Promise<DispatchAttempt> {
  if (!webhookUrl) {
    return { payload, outcome: "skipped_not_configured" };
  }
  try {
    const res = await fetcher(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { payload, outcome: "sent", httpStatus: res.status };
    }
    const bodyText = await res.text().catch(() => "");
    return {
      payload,
      outcome: "error",
      httpStatus: res.status,
      errorMessage: bodyText.slice(0, 200),
    };
  } catch (err) {
    return {
      payload,
      outcome: "error",
      errorMessage: err instanceof Error ? err.message : "unknown_send_failure",
    };
  }
}
