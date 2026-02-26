import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateSubscriptionStatusAdmin } from "@/lib/services/subscriptionServiceAdmin";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-12-15.clover" });
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const { sessionId, userId: requestUserId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 });
    }

    // Get subscription details
    const subscription = typeof subscriptionId === "string"
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : subscriptionId;

    // Get user ID from multiple sources (priority: request body > session metadata > subscription metadata > customer metadata)
    let userId: string | null = null;
    
    // 1. Use userId from request body (most reliable - sent directly from client)
    if (requestUserId) {
      userId = requestUserId;
      console.log(`[VERIFY-SESSION] Using userId from request body: ${userId}`);
    }
    // 2. Try session metadata
    else if (session.metadata?.userId) {
      userId = session.metadata.userId;
      console.log(`[VERIFY-SESSION] Using userId from session metadata: ${userId}`);
    }
    // 3. Try subscription metadata
    else if ((subscription as Stripe.Subscription).metadata?.userId) {
      userId = (subscription as Stripe.Subscription).metadata.userId;
      console.log(`[VERIFY-SESSION] Using userId from subscription metadata: ${userId}`);
    }
    // 4. Try customer metadata
    else if (session.customer) {
      const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
      const customer = await stripe.customers.retrieve(customerId);
      userId = (customer as Stripe.Customer).metadata?.userId || null;
      if (userId) {
        console.log(`[VERIFY-SESSION] Using userId from customer metadata: ${userId}`);
      }
    }

    if (!userId) {
      console.error(`[VERIFY-SESSION] ❌ Could not find userId. Session metadata:`, session.metadata);
      console.error(`[VERIFY-SESSION] Subscription metadata:`, (subscription as Stripe.Subscription).metadata);
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    // Update subscription status
    const stripeSubscription = subscription as Stripe.Subscription;
    const priceId = stripeSubscription.items.data[0]?.price.id;
    const planType = priceId?.includes("annual") ? "annual" : "monthly";
    // current_period_end is a number timestamp in Stripe.Subscription
    const currentPeriodEnd = ('current_period_end' in stripeSubscription && typeof stripeSubscription.current_period_end === 'number') 
      ? stripeSubscription.current_period_end 
      : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const expiresAt = new Date(currentPeriodEnd * 1000);

    console.log(`[VERIFY-SESSION] ✅ Updating subscription for user ${userId}, expiresAt: ${expiresAt.toISOString()}`);
    
    await updateSubscriptionStatusAdmin(userId, {
      isSubscribed: true,
      planType,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      stripeSubscriptionId: typeof subscriptionId === "string" ? subscriptionId : subscriptionId,
      expiresAt,
    });
    
    console.log(`[VERIFY-SESSION] ✅ Successfully updated subscription for user ${userId}`);

    return NextResponse.json({ success: true, isSubscribed: true });
  } catch (error: any) {
    console.error("Error verifying session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
