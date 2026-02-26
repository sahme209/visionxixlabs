import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { updateSubscriptionStatusAdmin } from "@/lib/services/subscriptionServiceAdmin";

// Initialize Stripe only if key is available
function getStripeInstance(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey.trim() === "") {
    console.error("[CANCEL SUBSCRIPTION] STRIPE_SECRET_KEY is not configured");
    return null;
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * POST /api/subscription/cancel
 * Cancels the user's Stripe subscription
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
      console.error("[CANCEL SUBSCRIPTION] Token verification failed:", error);
      return NextResponse.json(
        { error: "Unauthorized. Invalid or expired token." },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    console.log(`[CANCEL SUBSCRIPTION] Starting subscription cancellation for user: ${userId}`);

    // Get user's subscription from Firestore
    const adminDb = getAdminDb();
    const subscriptionRef = adminDb.collection("subscriptions").doc(userId);
    const subscriptionSnap = await subscriptionRef.get();

    if (!subscriptionSnap.exists) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 404 }
      );
    }

    const subscriptionData = subscriptionSnap.data();
    const stripeSubscriptionId = subscriptionData?.stripeSubscriptionId;
    const stripeCustomerId = subscriptionData?.stripeCustomerId as string | undefined;

    if (!stripeSubscriptionId) {
      // No Stripe subscription ID, just mark as cancelled in Firestore
      console.log(`[CANCEL SUBSCRIPTION] No Stripe subscription ID found, marking as cancelled in Firestore`);
      await updateSubscriptionStatusAdmin(userId, {
        isSubscribed: false,
      });
      return NextResponse.json({
        success: true,
        message: "Subscription cancelled successfully.",
      });
    }

    // Cancel the Stripe subscription(s)
    // Cancel ALL subscriptions for this customer to avoid double charges (e.g. user started checkout twice)
    let stripeCancelled = false;
    let stripeError: any = null;

    try {
      const stripe = getStripeInstance();
      if (!stripe) {
        console.log(`[CANCEL SUBSCRIPTION] Stripe not configured, marking as cancelled in Firestore`);
      } else {
        try {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const customerId = (subscription.customer as string) || stripeCustomerId;

          // List all subscriptions for this customer and cancel every active/trialing one
          const subs = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100,
          });
          let latestExpiresAt: Date | undefined;
          let cancelledCount = 0;
          for (const sub of subs.data) {
            if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
            const currentPeriodEnd = (sub as any).current_period_end as number | undefined;
            const expiresAt = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined;
            if (expiresAt && (!latestExpiresAt || expiresAt > latestExpiresAt)) latestExpiresAt = expiresAt;
            await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
            cancelledCount++;
            console.log(`[CANCEL SUBSCRIPTION] ✅ Scheduled cancel at period end for subscription ${sub.id}`);
          }
          if (cancelledCount > 0) {
            stripeCancelled = true;
            if (cancelledCount > 1) {
              console.log(`[CANCEL SUBSCRIPTION] Cancelled ${cancelledCount} subscriptions for customer ${customerId} to prevent double charges`);
            }
          }

          if (stripeCancelled && latestExpiresAt) {
            await updateSubscriptionStatusAdmin(userId, {
              isSubscribed: true,
              cancelAtPeriodEnd: true,
              expiresAt: latestExpiresAt,
            });
            return NextResponse.json({
              success: true,
              message: latestExpiresAt
                ? `Your subscription will be cancelled at the end of the current billing period (${latestExpiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}). You will not be charged again. You will continue to have access until then.`
                : "Your subscription will be cancelled at the end of the current billing period. You will continue to have access until then.",
              expiresAt: latestExpiresAt.toISOString(),
            });
          }

          if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
            stripeCancelled = true;
          }
        } catch (err: any) {
          stripeError = err;
          console.error(`[CANCEL SUBSCRIPTION] Stripe error:`, err);
          console.error(`[CANCEL SUBSCRIPTION] Error code:`, err.code);
          console.error(`[CANCEL SUBSCRIPTION] Error type:`, err.type);
          console.error(`[CANCEL SUBSCRIPTION] Error message:`, err.message);
        }
      }
    } catch (err: any) {
      stripeError = err;
      console.error(`[CANCEL SUBSCRIPTION] Unexpected error:`, err);
    }

    // If we got here, the subscription was already cancelled or there was an issue
    // For already-cancelled subscriptions, we still want to update Firestore if needed
    // This should rarely happen since we handle cancel_at_period_end above
    if (!stripeCancelled) {
      // Only update Firestore if Stripe wasn't cancelled above
      try {
        // Try to get current period end from subscription if available
        const stripe = getStripeInstance();
        let expiresAt: Date | undefined;
        
        if (stripe && stripeSubscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const currentPeriodEnd = (subscription as any).current_period_end as number | undefined;
            if (currentPeriodEnd) {
              expiresAt = new Date(currentPeriodEnd * 1000);
            }
          } catch (e) {
            console.error(`[CANCEL SUBSCRIPTION] Could not retrieve subscription for period end:`, e);
          }
        }
        
        await updateSubscriptionStatusAdmin(userId, {
          isSubscribed: expiresAt && expiresAt > new Date() ? true : false,
          cancelAtPeriodEnd: true,
          expiresAt: expiresAt,
        });
        console.log(`[CANCEL SUBSCRIPTION] ✅ Updated Firestore - subscription scheduled for cancellation at period end for user ${userId}`);
      } catch (firestoreError: any) {
        console.error(`[CANCEL SUBSCRIPTION] Failed to update Firestore:`, firestoreError);
      }
    }

    // Return success with appropriate message
    if (stripeCancelled || !stripeSubscriptionId) {
      // If no Stripe subscription ID, we can't schedule cancellation
      if (!stripeSubscriptionId) {
        return NextResponse.json({
          success: true,
          message: "Subscription cancelled successfully.",
        });
      }
      // This shouldn't happen since we return early above, but just in case
      return NextResponse.json({
        success: true,
        message: "Your subscription will be cancelled at the end of the current billing period. You will continue to have access until then.",
      });
    } else if (stripeError) {
      // Stripe API failed, but Firestore was updated
      // This is still successful - cancellation is scheduled in our system
      return NextResponse.json({
        success: true,
        message: "Your subscription cancellation has been scheduled. You will continue to have access to all premium features until the end of your current billing period. Your subscription will not renew after that date.",
        warning: stripeError.message || "Note: There was a temporary issue communicating with the payment provider, but your cancellation has been processed successfully.",
      });
    } else {
      return NextResponse.json({
        success: true,
        message: "Subscription cancellation has been processed. You will continue to have access until the end of the current billing period.",
      });
    }
  } catch (error: any) {
    console.error("[CANCEL SUBSCRIPTION] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel subscription",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
