/**
 * POST /api/webhooks/incidents/[provider]
 *
 * Inbound incident webhook receiver. Validates an HMAC signature
 * against INCIDENT_WEBHOOK_SECRET, normalises the vendor payload
 * (PagerDuty / Opsgenie / Slack / Teams) into the canonical
 * IncidentRecord shape, and enqueues for the autonomy loop.
 */

import { NextResponse, type NextRequest } from "next/server";
import { receiveIncidentWebhook, type IncidentReceiverProvider } from "@/lib/incidents/incidentWebhookReceiver";
import { resolveCorrelationId, apiOk, apiErr } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const VALID: IncidentReceiverProvider[] = ["pagerduty", "opsgenie", "slack", "teams"];

interface ProviderContext { params: Promise<{ provider: string }> }

export async function POST(req: NextRequest, ctx: ProviderContext) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const { provider } = await ctx.params;
    if (!VALID.includes(provider as IncidentReceiverProvider)) {
      throw AxiomErrors.validation("webhook.unknown_provider", `Unknown incident provider: ${provider}`);
    }
    const rawBody = await req.text();
    const signatureHeader =
      req.headers.get("x-signature") ??
      req.headers.get("x-pagerduty-signature") ??
      req.headers.get("x-opsgenie-signature") ??
      req.headers.get("x-slack-signature") ??
      null;
    const result = receiveIncidentWebhook({
      provider: provider as IncidentReceiverProvider,
      rawBody,
      signatureHeader,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: `webhook.${result.reason ?? "rejected"}`, userMessage: "Webhook rejected." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
        { status: result.status },
      );
    }
    return apiOk(
      { enqueued: result.enqueued, records: result.records },
      { correlationId, safetyContract: "incident_response_read_only", status: result.status === 202 ? 202 : 200 },
    );
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "incident_response_read_only" });
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: { code: "method.not_allowed", userMessage: "Use POST." } },
    { status: 405 },
  );
}
