/**
 * POST /api/webhooks/telemetry/[provider]
 *
 * Inbound telemetry webhook receiver. Validates an HMAC signature
 * against TELEMETRY_WEBHOOK_SECRET, normalises the vendor payload
 * into the canonical TelemetrySignal shape, and enqueues the typed
 * signal for the autonomy loop to consume.
 *
 * Supported providers (path param):
 *   /grafana, /datadog, /prometheus, /opentelemetry, /sentry
 *
 * The receiver NEVER triggers a remediation. It only enqueues a
 * typed signal — autonomy loop reads from the queue.
 */

import { NextResponse, type NextRequest } from "next/server";
import { receiveTelemetryWebhook, type ReceiverProvider } from "@/lib/telemetry/telemetryWebhookReceiver";
import { resolveCorrelationId, apiOk, apiErr } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS: ReceiverProvider[] = ["grafana", "datadog", "prometheus", "opentelemetry", "sentry"];

interface ProviderContext {
  params: Promise<{ provider: string }>;
}

export async function POST(req: NextRequest, ctx: ProviderContext) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const params = await ctx.params;
    const provider = params.provider as ReceiverProvider;
    if (!VALID_PROVIDERS.includes(provider)) {
      throw AxiomErrors.validation("webhook.unknown_provider", `Unknown telemetry provider: ${provider}`);
    }
    const rawBody = await req.text();
    // Provider-specific signature headers
    const signatureHeader =
      req.headers.get("x-signature") ??
      req.headers.get("x-hub-signature-256") ??
      req.headers.get("x-datadog-signature") ??
      req.headers.get("x-sentry-signature") ??
      null;
    const tenantHeader = req.headers.get("x-axiom-tenant");

    const result = receiveTelemetryWebhook({
      provider,
      rawBody,
      signatureHeader,
      tenantHeader,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: `webhook.${result.reason ?? "rejected"}`, userMessage: "Webhook rejected." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
        { status: result.status },
      );
    }

    return apiOk(
      { enqueued: result.enqueued, signals: result.signals },
      { correlationId, safetyContract: "telemetry_ingest_read_only", status: result.status === 202 ? 202 : 200 },
    );
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "telemetry_ingest_read_only" });
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: { code: "method.not_allowed", userMessage: "Use POST." } },
    { status: 405 },
  );
}
