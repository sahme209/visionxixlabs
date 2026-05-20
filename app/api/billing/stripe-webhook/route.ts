/**
 * POST /api/billing/stripe-webhook
 *
 * Stripe webhook receiver. Verifies the signature against
 * STRIPE_WEBHOOK_SECRET, parses the event, then updates the
 * TenantBillingPlan row idempotently (lastStripeEventId guards
 * against re-delivery).
 *
 * Hard rules:
 *   - Reads the raw body for signature verification — Next.js
 *     gives us req.text() unparsed.
 *   - Returns 200 on idempotent re-receive (never tells Stripe to
 *     retry on a duplicate event).
 *   - Returns 401 on signature failure (Stripe will retry the
 *     legitimate originals).
 *   - Returns 503 honestly when STRIPE_WEBHOOK_SECRET is unset.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature, isStripeWebhookConfigured } from "@/lib/billing/stripeHelper";
import { upsertBillingPlan } from "@/lib/billing/tenantBillingStore";
import { isBillingTier, type BillingStatus, type BillingTier } from "@/lib/billing/tierCatalog";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface StripeWebhookEvent {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      customer?: string;
      metadata?: { organizationId?: string; tier?: string };
      status?: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number;
    };
  };
}

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);

  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      { ok: false, error: { code: "stripe.not_configured", userMessage: "STRIPE_WEBHOOK_SECRET is not set." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const verdict = verifyWebhookSignature({ rawBody, signatureHeader: signature });
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "stripe.signature_invalid", userMessage: verdict.reason }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 401 },
    );
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody) as StripeWebhookEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "stripe.body_invalid", userMessage: "Webhook body is not valid JSON." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 400 },
    );
  }

  // Idempotency guard — bail when we've already processed this event id.
  if (event.id) {
    try {
      const existing = await prisma.tenantBillingPlan.findFirst({
        where: { lastStripeEventId: event.id },
        select: { organizationId: true },
      });
      if (existing) {
        return NextResponse.json({ ok: true, replay: true }, { status: 200 });
      }
    } catch {
      // Fall through — duplicate detection is best-effort.
    }
  }

  const obj = event.data?.object;
  const organizationId = obj?.metadata?.organizationId;
  const tierRaw = obj?.metadata?.tier;

  if (!organizationId || !tierRaw || !isBillingTier(tierRaw)) {
    // We accept the event but can't act on it without metadata.
    return NextResponse.json({ ok: true, ignored: "missing_metadata" }, { status: 200 });
  }

  const tier: BillingTier = tierRaw;
  const status: BillingStatus = mapStripeStatus(obj?.status);
  const currentPeriodEndsAt = obj?.current_period_end
    ? new Date(obj.current_period_end * 1000)
    : null;

  try {
    await upsertBillingPlan({
      organizationId,
      tier,
      status,
      trialEndsAt: null,
      currentPeriodEndsAt,
      stripeCustomerId: obj?.customer ?? null,
      stripeSubscriptionId: obj?.id ?? null,
      cancelAtPeriodEnd: obj?.cancel_at_period_end ?? false,
      lastStripeEventId: event.id ?? null,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "billing.write_failed",
          userMessage: err instanceof Error ? err.message.slice(0, 200) : "Failed to upsert billing plan.",
        },
        meta: { correlationId, generatedAt: new Date().toISOString() },
      },
      { status: 500 },
    );
  }
}

function mapStripeStatus(s: string | undefined): BillingStatus {
  switch ((s ?? "").toLowerCase()) {
    case "trialing":         return "trialing";
    case "active":           return "active";
    case "past_due":
    case "unpaid":           return "past_due";
    case "canceled":
    case "incomplete_expired": return "canceled";
    default:                 return "no_plan";
  }
}
