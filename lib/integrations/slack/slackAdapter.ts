/**
 * Slack integration adapter.
 *
 * Two posting modes:
 *   - Incoming webhook (simplest, no OAuth)
 *   - Bot token via chat.postMessage (richer, requires OAuth install)
 *
 * Builders for the Block Kit shapes operators see for approvals,
 * incidents, drift, and method proposals. Best-effort: NEVER throws,
 * returns a typed result so the outbound lane can log the failure
 * shape without leaking tokens.
 */

import "server-only";
import { aiFetch } from "@/lib/ai/aiFetch";

export type SlackSendMode = "webhook" | "bot_token";

export interface SlackSendInput {
  mode: SlackSendMode;
  /** Webhook URL for mode=webhook, otherwise channel id (C…) for mode=bot_token. */
  destination: string;
  /** OAuth bot token starting with xoxb- (required for mode=bot_token). */
  botToken?: string;
  text: string;                  // fallback / mobile preview
  blocks?: ReadonlyArray<Record<string, unknown>>;
}

export interface SlackSendResult {
  ok: boolean;
  latencyMs: number;
  errorKind?: "missing_destination" | "missing_token" | "rate_limited" | "bad_response" | "network" | "timeout";
  /** Operator-readable hint; never contains the token. */
  hint?: string;
}

const POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

const startsWith = (s: string | undefined, prefix: string): boolean => typeof s === "string" && s.startsWith(prefix);

export async function sendSlackMessage(input: SlackSendInput): Promise<SlackSendResult> {
  const t0 = Date.now();

  if (!input.destination) {
    return { ok: false, latencyMs: 0, errorKind: "missing_destination", hint: "destination is empty" };
  }

  try {
    if (input.mode === "webhook") {
      const { res, latencyMs } = await aiFetch({
        provider: "mock", // routed through aiFetch's classifier; provider tag is informational here
        url: input.destination,
        body: { text: input.text, blocks: input.blocks },
        timeoutMs: 8_000,
      });
      // Slack incoming webhooks return "ok" body on success.
      const body = await res.text();
      if (body.trim().toLowerCase() === "ok") {
        return { ok: true, latencyMs };
      }
      return { ok: false, latencyMs, errorKind: "bad_response", hint: `webhook body: ${body.slice(0, 80)}` };
    }

    // bot_token mode
    if (!startsWith(input.botToken, "xoxb-")) {
      return { ok: false, latencyMs: Date.now() - t0, errorKind: "missing_token", hint: "bot token must start with xoxb-" };
    }
    const { res, latencyMs } = await aiFetch({
      provider: "mock",
      url: POST_MESSAGE_URL,
      headers: { authorization: `Bearer ${input.botToken}` },
      body: { channel: input.destination, text: input.text, blocks: input.blocks },
      timeoutMs: 8_000,
    });
    const body = await res.text();
    if (body.includes('"ok":true')) return { ok: true, latencyMs };
    if (body.includes("ratelimited")) return { ok: false, latencyMs, errorKind: "rate_limited", hint: "slack ratelimited" };
    return { ok: false, latencyMs, errorKind: "bad_response", hint: body.slice(0, 80) };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const kind = (err as { kind?: string }).kind;
    if (kind === "timeout") return { ok: false, latencyMs, errorKind: "timeout" };
    if (kind === "rate_limited") return { ok: false, latencyMs, errorKind: "rate_limited" };
    return { ok: false, latencyMs, errorKind: "network", hint: "fetch failed" };
  }
}

/** Build a 3-block message for an approval packet. */
export function buildApprovalBlocks(input: {
  packetLabel: string;
  candidateKind: string;
  blastRadius: "single_resource" | "service" | "account" | "org";
  agentSupport: number;
  agentOppose: number;
  approveUrl: string;
  rejectUrl: string;
}): Array<Record<string, unknown>> {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: `Approval needed: ${input.packetLabel}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Kind*\n${input.candidateKind}` },
        { type: "mrkdwn", text: `*Blast radius*\n${input.blastRadius.replace("_", " ")}` },
        { type: "mrkdwn", text: `*Agents*\n${input.agentSupport} support · ${input.agentOppose} oppose` },
        { type: "mrkdwn", text: "*Safety*\napproval_only_no_execution" },
      ],
    },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "Open packet" }, url: input.approveUrl, style: "primary" },
        { type: "button", text: { type: "plain_text", text: "Reject" }, url: input.rejectUrl, style: "danger" },
      ],
    },
  ];
}

/** Build a 2-block message for an incident notification. */
export function buildIncidentBlocks(input: {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  service: string;
  detail: string;
  runbookUrl?: string;
}): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: `[${input.severity.toUpperCase()}] ${input.title}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Service*\n${input.service}` },
        { type: "mrkdwn", text: `*Detail*\n${input.detail.slice(0, 240)}` },
      ],
    },
  ];
  if (input.runbookUrl) {
    blocks.push({
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "Open runbook" }, url: input.runbookUrl, style: "primary" },
      ],
    });
  }
  return blocks;
}
