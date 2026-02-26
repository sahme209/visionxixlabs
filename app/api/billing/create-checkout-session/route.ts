import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

/**
 * Phase 6: Stripe checkout session (optional).
 * If STRIPE_SECRET_KEY missing, return friendly error + "Contact Sales" CTA.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      {
        error: "Checkout unavailable",
        message: "Contact Sales to upgrade.",
        cta: "contact",
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

  let body: { leadId?: string; tier?: string; sourcePage?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const leadId = body.leadId as string | undefined;
  const tier = (body.tier || "pro") as string;
  const sourcePage = body.sourcePage || "cloud-operator";

  if (leadId) {
    try {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId },
      });
      if (lead) {
        const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            fullPayload: {
              ...payload,
              billingIntent: {
                desiredTier: tier,
                createdAt: new Date().toISOString(),
                sourcePage,
              },
            } as object,
          },
        });
      }
    } catch {
      // non-fatal
    }
  }

  const stripe = new Stripe(secret);
  const priceId =
    process.env.STRIPE_PRICE_PRO ||
    process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    return NextResponse.json(
      {
        error: "Checkout configuration incomplete",
        message: "Contact Sales to upgrade.",
        cta: "contact",
      },
      { status: 503 }
    );
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: session.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL ?? req.nextUrl.origin}/cloud-operator?upgraded=1`,
      cancel_url: `${process.env.NEXTAUTH_URL ?? req.nextUrl.origin}/cloud-operator`,
      metadata: { leadId: leadId ?? "", tier, sourcePage },
    });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[billing checkout]", e);
    return NextResponse.json(
      { error: "Failed to create checkout session", cta: "contact" },
      { status: 500 }
    );
  }
}
