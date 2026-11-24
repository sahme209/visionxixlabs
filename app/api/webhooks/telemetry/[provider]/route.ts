/**
 * POST /api/webhooks/telemetry/[provider]
 *
 * Inbound telemetry webhook receiver. Validates an HMAC signature
 * against the signing secret for the configured workspace and provider,
 * normalises the vendor payload into the canonical TelemetrySignal shape,
 * and stores the signal for the configured workspace.
 *
 * Supported providers (path param):
 *   /grafana, /datadog, /prometheus, /opentelemetry, /sentry
 *
 * The receiver records evidence for report consumers.
 */

import {readGrafanaSignature} from "@/lib/observations/grafanaSignature";
import { NextResponse, type NextRequest } from "next/server";
import { receiveTelemetryWebhook, type ReceiverProvider } from "@/lib/telemetry/telemetryWebhookReceiver";
import { resolveCorrelationId, apiOk, apiErr } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS: ReceiverProvider[] = ["grafana", "datadog", "prometheus", "opentelemetry", "sentry"];

function rejected(reason: string, status: number, correlationId: string) {
  return NextResponse.json(
    {ok: false, error: {code: `webhook.${reason}`, userMessage: "Webhook rejected."}, meta: {correlationId, generatedAt: new Date().toISOString()}},
    {status},
  );
}

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
    const body = Buffer.from(await req.arrayBuffer());
    const rawBody = body.toString("utf8");
    const grafana = readGrafanaSignature(req.headers, body);
    const sentrySignature = req.headers.get("sentry-hook-signature");
    const sentryResource = req.headers.get("sentry-hook-resource");
    const sentryNative = sentrySignature !== null || sentryResource !== null;
    if (grafana.kind === "invalid" || (grafana.kind === "signed" && provider !== "grafana") ||
        (sentryNative && (provider !== "sentry" || !sentryResource || !sentrySignature || !/^[0-9a-f]{64}$/i.test(sentrySignature)))) {
      return rejected("invalid_signature", 401, correlationId);
    }
    // Provider-specific signature headers
    const signatureHeader = grafana.kind === "signed" ? grafana.signature : (
      sentrySignature ??
      req.headers.get("x-signature") ??
      req.headers.get("x-hub-signature-256") ??
      req.headers.get("x-datadog-signature") ??
      req.headers.get("x-sentry-signature") ??
      null);
    const tenantHeader = req.headers.get("x-axiom-tenant");

    const result = await receiveTelemetryWebhook({
      provider,
      rawBody,
      signatureHeader,
      authorizationHeader: provider === "prometheus" ? req.headers.get("authorization") : undefined,
      signingBytes: grafana.kind === "signed" ? grafana.bytes : sentryNative ? body : undefined,
      sentryResource: sentryResource ?? undefined,
      tenantHeader,
    });

    if (!result.ok) {
      return rejected(result.reason ?? "rejected", result.status, correlationId);
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
