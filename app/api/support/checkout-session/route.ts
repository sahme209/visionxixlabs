import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { checkRateLimit } from "@/lib/rateLimit";
import { assertCorrelationId, normalizeCheckoutInput, supporterCheckoutReadiness } from "@/lib/supporters/core";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
  if (!checkRateLimit(`supporter-checkout:${ip}`)) return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });

  const readiness = supporterCheckoutReadiness();
  if (!readiness.ready) return NextResponse.json({ error: readiness.reason }, { status: 503 });

  try {
    const correlationId = assertCorrelationId(request.headers.get("idempotency-key"));
    const input = normalizeCheckoutInput(await request.json());
    if (input.website) return NextResponse.json({ error: "Unable to start checkout." }, { status: 400 });

    const purchase = await prisma.foundingSupporterPurchase.upsert({
      where: { correlationId },
      create: {
        correlationId,
        email: input.email,
        displayName: input.displayName,
        publicName: input.recognitionConsent ? input.publicName : null,
        recognitionConsent: input.recognitionConsent,
        updatesOptIn: input.updatesOptIn,
        amountCents: input.amountCents,
      },
      update: {},
    });

    if (purchase.email !== input.email || purchase.amountCents !== input.amountCents) {
      return NextResponse.json({ error: "This checkout key was already used for different details." }, { status: 409 });
    }
    if (purchase.stripeCheckoutSessionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const existing = await stripe.checkout.sessions.retrieve(purchase.stripeCheckoutSessionId);
      if (existing.url && existing.status === "open") return NextResponse.json({ url: existing.url });
      return NextResponse.json({ error: "This checkout is no longer open. Start a new one." }, { status: 409 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const origin = request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.email,
      client_reference_id: purchase.id,
      success_url: `${origin}/support/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/support?checkout=cancelled#join`,
      billing_address_collection: "auto",
      automatic_tax: { enabled: process.env.STRIPE_SUPPORTER_AUTOMATIC_TAX === "true" },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: {
            name: "Axiom Founding Supporter",
            description: "One-time digital supporter purchase, including a Founding Supporter badge and development updates when opted in.",
          },
        },
      }],
      metadata: { supporterPurchaseId: purchase.id, purpose: "axiom_founding_supporter" },
      payment_intent_data: { metadata: { supporterPurchaseId: purchase.id, purpose: "axiom_founding_supporter" } },
      submit_type: "pay",
    }, { idempotencyKey: `supporter_${correlationId}` });

    await prisma.foundingSupporterPurchase.update({ where: { id: purchase.id }, data: { stripeCheckoutSessionId: session.id } });
    if (!session.url) throw new Error("Stripe did not return a hosted checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout.";
    const safe = /amount|email|terms|recognition|idempotency|different details|no longer open/i.test(message) ? message : "Unable to start secure checkout.";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
