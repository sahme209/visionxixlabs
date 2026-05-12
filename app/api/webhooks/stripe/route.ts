import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/security/auditLog";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

function priceToPlan(priceId: string | null): "starter" | "growth" | "scale" | "enterprise" | null {
  if (!priceId) return null;
  const starter = (process.env.STRIPE_PRICES_STARTER ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const growth = (process.env.STRIPE_PRICES_GROWTH ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const scale = (process.env.STRIPE_PRICES_SCALE ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const enterprise = (process.env.STRIPE_PRICES_ENTERPRISE ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (starter.includes(priceId)) return "starter";
  if (growth.includes(priceId)) return "growth";
  if (scale.includes(priceId)) return "scale";
  if (enterprise.includes(priceId)) return "enterprise";
  return null;
}

async function recordStripeWebhookEvent(eventId: string, eventType: string): Promise<void> {
  await logAudit({
    leadId: null,
    action: "stripe_webhook_processed",
    actor: "system",
    metadata: { stripeEventId: eventId, stripeEventType: eventType },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await recordStripeWebhookEvent(event.id, event.type).catch(() => {});

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionWithItems = await getStripe().checkout.sessions.retrieve(session.id, {
      expand: ["line_items", "line_items.data.price"],
    });

    const lineItems = sessionWithItems.line_items?.data ?? [];
    const priceId = lineItems[0]?.price?.id ?? null;
    const plan = priceToPlan(priceId);

    const email = session.customer_email ?? session.customer_details?.email;
    if (!email) {
      return NextResponse.json({ received: true });
    }

    if (plan) {
      try {
        await prisma.user.updateMany({
          where: { email },
          data: {
            plan,
            stripeCustomerId: session.customer as string ?? undefined,
            stripeSubscriptionId: session.subscription as string ?? undefined,
          },
        });
      } catch (e) {
        console.error("[Stripe Webhook] Failed to update user:", e);
      }
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    const plan = event.type === "customer.subscription.deleted" ? null : priceToPlan(priceId);

    if (sub.customer) {
      try {
        const customers = await prisma.user.findMany({
          where: { stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id },
        });
        for (const u of customers) {
          await prisma.user.update({
            where: { id: u.id },
            data: { plan: plan ?? undefined, stripeSubscriptionId: sub.id },
          });
        }
      } catch (e) {
        console.error("[Stripe Webhook] Failed to update subscription:", e);
      }
    }
  }

  return NextResponse.json({ received: true });
}
