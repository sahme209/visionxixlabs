import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { updateSubscriptionStatusAdmin } from "@/lib/services/subscriptionServiceAdmin";

// Initialize Stripe only if key is available
function getStripeInstance(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey.trim() === "") {
    console.error("[RESTORE SUBSCRIPTION] STRIPE_SECRET_KEY is not configured");
    return null;
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * POST /api/subscription/restore
 * Reactivates a cancelled subscription by removing cancel_at_period_end
 * Requires authentication token in Authorization header
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized. Missing or invalid authorization token." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    
    // Verify token and get user ID
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error: any) {
      console.error("[RESTORE SUBSCRIPTION] Token verification failed:", error);
      return NextResponse.json(
        { error: "Unauthorized. Invalid or expired token." },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    console.log(`[RESTORE SUBSCRIPTION] Starting subscription reactivation for user: ${userId}`);

    // Get user's subscription from Firestore
    const adminDb = getAdminDb();
    const subscriptionRef = adminDb.collection("subscriptions").doc(userId);
    const subscriptionSnap = await subscriptionRef.get();

    if (!subscriptionSnap.exists) {
      return NextResponse.json(
        { error: "No subscription found." },
        { status: 404 }
      );
    }

    const subscriptionData = subscriptionSnap.data();
    // Handle stripeSubscriptionId - it should be a string, but handle corrupt/missing data
    let stripeSubscriptionId: string | undefined = undefined;
    let recoveredStripeCustomerId: string | undefined = undefined;
    if (typeof subscriptionData?.stripeSubscriptionId === 'string' && subscriptionData.stripeSubscriptionId.length > 0) {
      stripeSubscriptionId = subscriptionData.stripeSubscriptionId;
    } else {
      // stripeSubscriptionId is missing, boolean, object, or otherwise invalid - fetch from Stripe
      let customerId = typeof subscriptionData?.stripeCustomerId === 'string' ? subscriptionData.stripeCustomerId : undefined;
      if (!customerId) {
        // Fallback: find Stripe customer by userId in metadata
        try {
          const stripe = getStripeInstance();
          if (stripe) {
            const customers = await stripe.customers.list({ limit: 100 });
            const match = customers.data.find((c) => c.metadata?.userId === userId);
            if (match) {
              customerId = match.id;
              recoveredStripeCustomerId = match.id;
              console.log(`[RESTORE SUBSCRIPTION] Found Stripe customer by userId: ${customerId}`);
            }
          }
        } catch (err: any) {
          console.error(`[RESTORE SUBSCRIPTION] Could not find Stripe customer by userId:`, err);
        }
      }
      if (customerId) {
        console.log(`[RESTORE SUBSCRIPTION] ⚠️ stripeSubscriptionId invalid/missing (type: ${typeof subscriptionData?.stripeSubscriptionId}). Fetching from Stripe customer...`);
        try {
          const stripe = getStripeInstance();
          if (stripe) {
            const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
            // Prefer active/trialing with cancel_at_period_end (the one we can restore)
            const restorable = subscriptions.data.find((s) =>
              (s.status === "active" || s.status === "trialing") && (s as any).cancel_at_period_end === true
            );
            const anyActive = subscriptions.data.find((s) => s.status === "active" || s.status === "trialing");
            const sub = restorable || anyActive || subscriptions.data[0];
            if (sub) {
              stripeSubscriptionId = sub.id;
              console.log(`[RESTORE SUBSCRIPTION] ✅ Found subscription ID from Stripe: ${stripeSubscriptionId} (status: ${sub.status})`);
            }
          }
        } catch (err: any) {
          console.error(`[RESTORE SUBSCRIPTION] Could not fetch subscription ID from Stripe customer:`, err);
        }
      }
    }
    
    const cancelAtPeriodEnd = subscriptionData?.cancelAtPeriodEnd;
    const isSubscribedFlag = subscriptionData?.isSubscribed === true;

    // If subscription is active and not scheduled for cancellation, nothing to restore
    if (isSubscribedFlag && !cancelAtPeriodEnd) {
      return NextResponse.json({
        success: true,
        message: "Your subscription is already active and not scheduled for cancellation.",
      });
    }

    // If no Stripe subscription ID, can't restore - redirect to subscribe
    if (!stripeSubscriptionId) {
      return NextResponse.json(
        {
          expired: true,
          canResubscribe: true,
          redirectTo: "/subscribe",
          message: "No subscription found. Subscribe to regain access.",
        },
        { status: 200 }
      );
    }

    // Get expiresAt from Firestore, or fetch from Stripe if missing
    let expiresDate: Date | undefined;
    const expiresAt = subscriptionData?.expiresAt;
    if (expiresAt) {
      if (expiresAt.toDate) {
        expiresDate = expiresAt.toDate();
      } else if (expiresAt instanceof Date) {
        expiresDate = expiresAt;
      } else if (typeof expiresAt === 'string' || typeof expiresAt === 'number') {
        expiresDate = new Date(expiresAt);
      }
    }

    // If expiresAt is missing but we have Stripe subscription ID, fetch from Stripe
    if (!expiresDate && stripeSubscriptionId) {
      try {
        const stripe = getStripeInstance();
        if (stripe) {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const currentPeriodEnd = (subscription as any).current_period_end as number | undefined;
          if (currentPeriodEnd) {
            expiresDate = new Date(currentPeriodEnd * 1000);
          }
        }
      } catch (err: any) {
        console.error(`[RESTORE SUBSCRIPTION] Could not fetch period end from Stripe:`, err);
      }
    }

    // If subscription has already expired, cannot restore - return friendly payload so client can redirect to subscribe
    if (expiresDate && expiresDate <= new Date()) {
      return NextResponse.json(
        {
          expired: true,
          canResubscribe: true,
          redirectTo: "/subscribe",
          message: "Your subscription has expired. Subscribe again to regain access.",
        },
        { status: 200 }
      );
    }

    // If we don't have expiresAt and can't get it from Stripe, still allow restore if there's a Stripe subscription
    if (!expiresDate && !stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Unable to determine subscription expiration date. Please contact support." },
        { status: 400 }
      );
    }

    // Reactivate in Stripe
    let stripeReactivated = false;
    if (stripeSubscriptionId) {
      try {
        const stripe = getStripeInstance();
        if (!stripe) {
          console.log(`[RESTORE SUBSCRIPTION] Stripe not configured, updating Firestore only`);
        } else {
          try {
            const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            
            if (subscription.status === "active" || subscription.status === "trialing") {
              // Remove cancel_at_period_end flag in Stripe
              const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
                cancel_at_period_end: false,
              });
              
              console.log(`[RESTORE SUBSCRIPTION] ✅ Reactivated Stripe subscription ${stripeSubscriptionId}`);
              stripeReactivated = true;
              
              // Get updated period end
              const currentPeriodEnd = (updatedSubscription as any).current_period_end as number | undefined;
              const newExpiresAt = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : expiresDate;
              
              // Update Firestore (persist stripeSubscriptionId/stripeCustomerId if recovered from Stripe)
              const customerId = typeof subscription.customer === "string" ? subscription.customer : (subscription.customer as Stripe.Customer)?.id;
              await updateSubscriptionStatusAdmin(userId, {
                isSubscribed: true,
                cancelAtPeriodEnd: false,
                expiresAt: newExpiresAt,
                stripeSubscriptionId,
                ...(customerId && { stripeCustomerId: customerId }),
              });
              
              return NextResponse.json({
                success: true,
                message: newExpiresAt 
                  ? `Your subscription has been reactivated successfully. Your next billing date is ${newExpiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
                  : "Your subscription has been reactivated successfully.",
                expiresAt: newExpiresAt?.toISOString(),
              });
            } else {
              return NextResponse.json(
                { error: `Cannot reactivate subscription. Current status: ${subscription.status}` },
                { status: 400 }
              );
            }
          } catch (err: any) {
            console.error(`[RESTORE SUBSCRIPTION] Stripe error:`, err);
            // Continue to update Firestore even if Stripe fails
          }
        }
      } catch (err: any) {
        console.error(`[RESTORE SUBSCRIPTION] Unexpected error:`, err);
      }
    }

    // Update Firestore to remove cancelAtPeriodEnd flag (persist stripeSubscriptionId/stripeCustomerId if recovered)
    try {
      const stripeCustomerIdToSave = typeof subscriptionData?.stripeCustomerId === 'string' 
        ? subscriptionData.stripeCustomerId 
        : recoveredStripeCustomerId;
      await updateSubscriptionStatusAdmin(userId, {
        isSubscribed: true,
        cancelAtPeriodEnd: false,
        expiresAt: expiresDate,
        ...(stripeSubscriptionId && { stripeSubscriptionId }),
        ...(stripeCustomerIdToSave && { stripeCustomerId: stripeCustomerIdToSave }),
      });
      console.log(`[RESTORE SUBSCRIPTION] ✅ Updated Firestore - subscription reactivated for user ${userId}`);
      
      return NextResponse.json({
        success: true,
        message: expiresDate 
          ? `Your subscription has been reactivated successfully. Your access will continue until ${expiresDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} and will auto-renew after that.`
          : "Your subscription has been reactivated successfully.",
        expiresAt: expiresDate?.toISOString(),
        warning: !stripeReactivated && stripeSubscriptionId 
          ? "Note: There was an issue communicating with the payment provider, but your subscription has been reactivated in our system."
          : undefined,
      });
    } catch (firestoreError: any) {
      console.error(`[RESTORE SUBSCRIPTION] Failed to update Firestore:`, firestoreError);
      return NextResponse.json(
        {
          error: "Failed to restore subscription",
          message: "Unable to update subscription status. Please try again or contact support.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[RESTORE SUBSCRIPTION] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to restore subscription",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
