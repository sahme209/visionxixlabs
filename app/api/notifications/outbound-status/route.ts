/**
 * GET /api/notifications/outbound-status
 *
 * Returns the configuration posture of the outbound notification lane:
 * which channels have a webhook URL configured, dedupe stats, etc.
 * Never returns secrets — only presence booleans.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { loadAppEnv } from "@/lib/config/env";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

interface OutboundChannelPosture {
  channel: "slack" | "microsoft_teams" | "generic_webhook" | "email";
  configured: boolean;
  signed?: boolean;
  hint: string;
}

interface OutboundStatus {
  channels: OutboundChannelPosture[];
  configuredCount: number;
  generatedAt: string;
}

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const env = loadAppEnv();
    const channels: OutboundChannelPosture[] = [
      { channel: "slack", configured: Boolean(env.slackWebhookUrl), hint: "Set SLACK_WEBHOOK_URL (incoming-webhook URL)." },
      { channel: "microsoft_teams", configured: Boolean(env.teamsWebhookUrl), hint: "Set TEAMS_WEBHOOK_URL (Office 365 connector URL)." },
      {
        channel: "generic_webhook",
        configured: Boolean(env.outboundWebhookUrl),
        signed: Boolean(env.outboundWebhookSecret),
        hint: "Set OUTBOUND_WEBHOOK_URL (+ optional OUTBOUND_WEBHOOK_SECRET for HMAC-SHA256 signing).",
      },
      { channel: "email", configured: false, hint: "Email transport pending — Phase 56b." },
    ];
    const status: OutboundStatus = {
      channels,
      configuredCount: channels.filter((c) => c.configured).length,
      generatedAt: new Date().toISOString(),
    };
    return apiOk(status, {
      correlationId,
      safetyContract: "notification_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "notification_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
