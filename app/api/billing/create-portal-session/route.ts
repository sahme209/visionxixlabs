import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";

/**
 * Phase 6: Stripe portal session (manage subscription).
 * If env vars missing, return friendly error.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const portalReturnUrl =
    process.env.STRIPE_PORTAL_RETURN_URL ||
    `${process.env.NEXTAUTH_URL ?? req.nextUrl.origin}/cloud-operator`;

  if (!secret) {
    return NextResponse.json(
      {
        error: "Billing portal unavailable",
        message: "Self-service billing management is not configured.",
        cta: "plans",
      },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sign in required", redirectUrl: "/auth/signin?callbackUrl=/cloud-operator" },
      { status: 401 }
    );
  }

  const stripe = new Stripe(secret);
  const customerId = (session.user as { stripeCustomerId?: string }).stripeCustomerId;

  if (!customerId) {
    return NextResponse.json(
      {
        error: "No subscription found",
        message: "No self-service subscription is attached to this account.",
        cta: "plans",
      },
      { status: 400 }
    );
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: portalReturnUrl,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (e) {
    console.error("[billing portal]", e);
    return NextResponse.json(
      { error: "Failed to create portal session", cta: "plans" },
      { status: 500 }
    );
  }
}
