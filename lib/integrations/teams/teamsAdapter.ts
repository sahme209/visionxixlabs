/**
 * Microsoft Teams integration adapter.
 *
 * Two posting paths:
 *   - Incoming webhook (legacy connector, simplest): POST JSON with
 *     "type":"message" + adaptive card attachment.
 *   - Bot (Graph) — operator installs the Axiom Teams app; we post
 *     via Graph API. Bot path requires AAD tenant + app credentials
 *     and is gated behind the higher-tier installer.
 *
 * Adaptive Card builders for approval / incident / drift packets.
 * NEVER throws.
 */

import "server-only";
import { aiFetch } from "@/lib/ai/aiFetch";

export type TeamsSendMode = "webhook" | "graph_bot";

export interface TeamsSendInput {
  mode: TeamsSendMode;
  /** Incoming webhook URL for mode=webhook; Graph chat id for graph_bot. */
  destination: string;
  /** Bearer token (Graph access token) for graph_bot. */
  graphAccessToken?: string;
  /** AdaptiveCard JSON. */
  card: Record<string, unknown>;
  /** Fallback summary shown in notifications. */
  summary: string;
}

export interface TeamsSendResult {
  ok: boolean;
  latencyMs: number;
  errorKind?: "missing_destination" | "missing_token" | "rate_limited" | "bad_response" | "network" | "timeout";
  hint?: string;
}

const GRAPH_CHAT_MESSAGE_URL = (chatId: string): string =>
  `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages`;

export async function sendTeamsMessage(input: TeamsSendInput): Promise<TeamsSendResult> {
  const t0 = Date.now();
  if (!input.destination) {
    return { ok: false, latencyMs: 0, errorKind: "missing_destination", hint: "destination is empty" };
  }

  try {
    if (input.mode === "webhook") {
      const webhookBody = {
        type: "message",
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: input.card,
        }],
        summary: input.summary,
      };
      const { res, latencyMs } = await aiFetch({
        provider: "mock",
        url: input.destination,
        body: webhookBody,
        timeoutMs: 8_000,
      });
      // Teams incoming webhooks return "1" on success.
      const body = (await res.text()).trim();
      if (body === "1") return { ok: true, latencyMs };
      return { ok: false, latencyMs, errorKind: "bad_response", hint: body.slice(0, 80) };
    }

    // graph_bot mode
    if (!input.graphAccessToken) {
      return { ok: false, latencyMs: Date.now() - t0, errorKind: "missing_token", hint: "graphAccessToken required" };
    }
    const graphBody = {
      body: {
        contentType: "html",
        content: `<attachment id="card0"></attachment>`,
      },
      attachments: [{
        id: "card0",
        contentType: "application/vnd.microsoft.card.adaptive",
        content: JSON.stringify(input.card),
        name: input.summary.slice(0, 80),
      }],
    };
    const { res, latencyMs } = await aiFetch({
      provider: "mock",
      url: GRAPH_CHAT_MESSAGE_URL(input.destination),
      headers: { authorization: `Bearer ${input.graphAccessToken}` },
      body: graphBody,
      timeoutMs: 8_000,
    });
    // Graph returns 201 with a JSON body on success.
    if (res.status === 201) return { ok: true, latencyMs };
    const body = await res.text();
    return { ok: false, latencyMs, errorKind: "bad_response", hint: body.slice(0, 80) };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const kind = (err as { kind?: string }).kind;
    if (kind === "timeout") return { ok: false, latencyMs, errorKind: "timeout" };
    if (kind === "rate_limited") return { ok: false, latencyMs, errorKind: "rate_limited" };
    return { ok: false, latencyMs, errorKind: "network", hint: "fetch failed" };
  }
}

const ADAPTIVE_VERSION = "1.5";

/** Adaptive Card for an approval packet. */
export function buildTeamsApprovalCard(input: {
  packetLabel: string;
  candidateKind: string;
  blastRadius: "single_resource" | "service" | "account" | "org";
  agentSupport: number;
  agentOppose: number;
  approveUrl: string;
  rejectUrl: string;
}): Record<string, unknown> {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: ADAPTIVE_VERSION,
    body: [
      { type: "TextBlock", size: "Medium", weight: "Bolder", text: `Approval needed: ${input.packetLabel}` },
      {
        type: "FactSet",
        facts: [
          { title: "Kind", value: input.candidateKind },
          { title: "Blast radius", value: input.blastRadius.replace("_", " ") },
          { title: "Agents", value: `${input.agentSupport} support · ${input.agentOppose} oppose` },
          { title: "Safety", value: "approval_only_no_execution" },
        ],
      },
    ],
    actions: [
      { type: "Action.OpenUrl", title: "Open packet", url: input.approveUrl, style: "positive" },
      { type: "Action.OpenUrl", title: "Reject", url: input.rejectUrl, style: "destructive" },
    ],
  };
}

/** Adaptive Card for an incident notification. */
export function buildTeamsIncidentCard(input: {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  service: string;
  detail: string;
  runbookUrl?: string;
}): Record<string, unknown> {
  const actions: Array<Record<string, unknown>> = [];
  if (input.runbookUrl) {
    actions.push({ type: "Action.OpenUrl", title: "Open runbook", url: input.runbookUrl, style: "positive" });
  }
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: ADAPTIVE_VERSION,
    body: [
      { type: "TextBlock", size: "Medium", weight: "Bolder", text: `[${input.severity.toUpperCase()}] ${input.title}` },
      {
        type: "FactSet",
        facts: [
          { title: "Service", value: input.service },
          { title: "Detail", value: input.detail.slice(0, 240) },
        ],
      },
    ],
    actions,
  };
}
