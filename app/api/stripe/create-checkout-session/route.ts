import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminDb } from "@/lib/firebase-admin";

// Initialize Stripe with secret key (only if available)
const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover",
  });
};

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable." },
        { status: 500 }
      );
    }

    // Get request body once
    const requestBody = await request.json();
    const { priceId, userId } = requestBody;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required to subscribe. Please sign in again." },
        { status: 400 }
      );
    }

    // Only support monthly plan - $4.99/month
    let selectedPriceId: string;

    // Check if we have a configured price ID
    const configuredPriceId = process.env.STRIPE_PRICE_ID_MONTHLY;
    if (configuredPriceId && configuredPriceId !== "price_monthly_test") {
      selectedPriceId = configuredPriceId;
    } else {
      // Create product and price on the fly
      const product = await stripe.products.create({
        name: "VisaNova Premium Monthly",
        description: "Premium subscription for VisaNova - Advanced timeline tracking and regularly updated insights",
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 499, // $4.99 in cents
        currency: "usd",
        recurring: {
          interval: "month",
        },
      });

      selectedPriceId = price.id;
    }

    // Create or retrieve customer with userId in metadata
    let customerId: string | undefined;
    if (userId) {
      // Find existing customer: search first (reliable), then list, then Firestore stripeCustomerId
      let existingCustomer: Stripe.Customer | undefined;
      try {
        const escaped = userId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        const searchResult = await stripe.customers.search({
          query: `metadata['userId']:'${escaped}'`,
          limit: 1,
        });
        existingCustomer = searchResult.data[0];
      } catch {
        // Search not available (e.g. India) or error - fall back to list
        const customers = await stripe.customers.list({ limit: 100 });
        existingCustomer = customers.data.find((c) => c.metadata?.userId === userId);
      }
      // Fallback: fetch by stripeCustomerId from Firestore (handles list pagination)
      if (!existingCustomer) {
        try {
          const adminDb = getAdminDb();
          const subSnap = await adminDb.collection("subscriptions").doc(userId).get();
          const stripeCustomerId = subSnap.data()?.stripeCustomerId;
          if (typeof stripeCustomerId === "string" && stripeCustomerId.startsWith("cus_")) {
            existingCustomer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
          }
        } catch {
          // Ignore - will create new customer
        }
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        // CRITICAL: Check Stripe directly for existing active/trialing subscriptions to prevent duplicate charges
        const existingSubs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 10,
        });
        const now = Math.floor(Date.now() / 1000);
        // Exclude subscriptions whose period has ended (current_period_end in past) - they're effectively canceled
        const activeOrTrialingOrPastDue = existingSubs.data.filter((s) => {
          if (s.status !== "active" && s.status !== "trialing" && s.status !== "past_due") return false;
          const periodEnd = (s as any).current_period_end as number | undefined;
          if (periodEnd && periodEnd < now) return false; // Period ended, treat as inactive
          return true;
        });
        // Only block if user has active subscription (period not ended) WITHOUT cancel_at_period_end
        const allScheduledToCancel = activeOrTrialingOrPastDue.length > 0 &&
          activeOrTrialingOrPastDue.every((s) => (s as any).cancel_at_period_end === true);
        const hasActiveWithoutCancel = activeOrTrialingOrPastDue.some((s) => (s as any).cancel_at_period_end !== true);

        if (hasActiveWithoutCancel) {
          // Instead of 409, redirect to Stripe Billing Portal - user can update payment (past_due) or manage subscription (active)
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app";
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${baseUrl}/settings?from=portal`,
          });
          console.log(`[CHECKOUT] User ${userId} has active sub - redirecting to portal instead of 409`);
          return NextResponse.json({ url: portalSession.url });
        }
        if (activeOrTrialingOrPastDue.length === 0) {
          console.log(`[CHECKOUT] User ${userId} has no active Stripe subscriptions (or all period-ended), allowing checkout`);
        } else if (allScheduledToCancel) {
          console.log(`[CHECKOUT] User ${userId} has subscription(s) with cancel_at_period_end - allowing checkout`);
        }
        // Update customer metadata to ensure userId is set
        await stripe.customers.update(existingCustomer.id, {
          metadata: { userId },
        });
      } else {
        // Create new customer with userId in metadata
        const customer = await stripe.customers.create({
          metadata: { userId },
        });
        customerId = customer.id;
      }
    }

    // Ensure customer metadata is set before creating session
    if (customerId && userId) {
      try {
        await stripe.customers.update(customerId, {
          metadata: {
            userId: userId,
          },
        });
        console.log(`[CHECKOUT] Updated customer ${customerId} metadata with userId: ${userId}`);
      } catch (err) {
        console.error(`[CHECKOUT] Error updating customer metadata:`, err);
        // Continue anyway - metadata might already be set
      }
    }

    // --- Determine trial eligibility: 3-day free trial for first-time subscribers ---
    // Default to TRUE when in doubt so we never charge users who should get a trial
    let eligibleForTrial = true;
    let hasUsedTrial = false;

    if (userId) {
      try {
        const adminDb = getAdminDb();
        const subscriptionRef = adminDb.collection("subscriptions").doc(userId);
        const subscriptionSnap = await subscriptionRef.get();

        if (subscriptionSnap.exists) {
          const subData = subscriptionSnap.data() as any;
          const hasStripeSub =
            typeof subData?.stripeSubscriptionId === "string" &&
            subData.stripeSubscriptionId.length > 0;
          // Block trial only if: explicit flag OR completed subscription (stripeSubscriptionId)
          // Allow trial for: no sub doc, or stripeCustomerId-only (abandoned checkout, no stripeSubscriptionId)
          hasUsedTrial =
            subData?.hasUsedTrial === true ||
            hasStripeSub; // one trial per customer ever

          if (hasUsedTrial) {
            eligibleForTrial = false;
          }
        }
        // else: no subscription record → keep eligibleForTrial true
      } catch (err) {
        // On any error (Firestore down, permissions, etc.), grant trial to avoid charging users
        console.error(
          `[CHECKOUT] Error checking trial eligibility for user ${userId}. Granting 3-day trial to be safe.`,
          err
        );
        eligibleForTrial = true;
      }
    }

    console.log(
      `[CHECKOUT] Trial for user ${userId}: eligibleForTrial=${eligibleForTrial}, hasUsedTrial=${hasUsedTrial} → trial_period_days=${eligibleForTrial ? 3 : 0}`
    );

    // Create Checkout Session
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        userId: userId || "",
        trialApplied: eligibleForTrial ? "true" : "false",
      },
    };

    // Apply trial only if eligible (card collected at checkout, charged after trial)
    if (eligibleForTrial) {
      subscriptionData.trial_period_days = 3;
    }

    // Idempotency key prevents duplicate sessions from double-clicks or retries (same key = same response)
    const idempotencyKey = `checkout-${userId}-${Math.floor(Date.now() / 60000)}`;
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          { price: selectedPriceId, quantity: 1 },
        ],
        mode: "subscription",
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/subscribe?canceled=true`,
        metadata: { plan: priceId, userId: userId || "" },
        subscription_data: subscriptionData,
      },
      { idempotencyKey }
    );

    console.log(
      `[CHECKOUT] Created session ${session.id} for user ${userId}, customer ${customerId} (idempotency: ${idempotencyKey})`
    );

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
