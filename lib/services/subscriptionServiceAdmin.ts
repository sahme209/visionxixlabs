/**
 * Server-side subscription service using Firebase Admin SDK
 * This is used by API routes (webhooks) that need to write to Firestore without authentication
 */

import { getAdminDb } from "@/lib/firebase-admin";

export type SubscriptionLifecycleStatus = "trialing" | "active" | "past_due" | "unpaid" | "canceled";

export interface SubscriptionStatus {
  isSubscribed: boolean;
  planType?: "monthly" | "annual";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /**
   * Legacy field – kept for backward compatibility.
   * Represents when access should end (end of paid or trial period).
   */
  expiresAt?: Date;
  cancelAtPeriodEnd?: boolean;
  lastUpdated?: Date;
  /**
   * Stripe subscription.status – used for UI and gating logic.
   * We keep isSubscribed as the primary gate so older code keeps working.
   */
  status?: SubscriptionLifecycleStatus;
  /**
   * End of the trial period (if any).
   */
  trialEnd?: Date;
  /**
   * End of the current billing period (paid or trial).
   */
  currentPeriodEnd?: Date;
  /**
   * Guardrail flag – once true, the user is no longer eligible for another free trial.
   */
  hasUsedTrial?: boolean;
}

/**
 * Update subscription status (server-side version using Admin SDK)
 * Called by webhook handlers
 */
export async function updateSubscriptionStatusAdmin(
  userId: string,
  status: {
    isSubscribed: boolean;
    planType?: "monthly" | "annual";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    expiresAt?: Date;
    cancelAtPeriodEnd?: boolean;
    status?: SubscriptionLifecycleStatus;
    trialEnd?: Date;
    currentPeriodEnd?: Date;
    hasUsedTrial?: boolean;
  }
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const subscriptionRef = adminDb.collection("subscriptions").doc(userId);
    const updateData: any = {
      isSubscribed: status.isSubscribed,
      lastUpdated: new Date(),
    };
    
    if (status.planType) updateData.planType = status.planType;
    if (status.stripeCustomerId) updateData.stripeCustomerId = status.stripeCustomerId;
    if (status.stripeSubscriptionId) updateData.stripeSubscriptionId = status.stripeSubscriptionId;
    if (status.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = status.cancelAtPeriodEnd;
    if (status.status) updateData.status = status.status;
    if (status.hasUsedTrial !== undefined) updateData.hasUsedTrial = status.hasUsedTrial;
    
    // Handle expiresAt - convert to Firestore Timestamp if it's a Date
    const { Timestamp } = await import("firebase-admin/firestore");

    // expiresAt (legacy access cutoff)
    if (status.expiresAt) {
      updateData.expiresAt =
        status.expiresAt instanceof Date
          ? Timestamp.fromDate(status.expiresAt)
          : status.expiresAt;
    }

    // trialEnd
    if (status.trialEnd) {
      updateData.trialEnd =
        status.trialEnd instanceof Date
          ? Timestamp.fromDate(status.trialEnd)
          : status.trialEnd;
    }

    // currentPeriodEnd
    if (status.currentPeriodEnd) {
      updateData.currentPeriodEnd =
        status.currentPeriodEnd instanceof Date
          ? Timestamp.fromDate(status.currentPeriodEnd)
          : status.currentPeriodEnd;
    }
    
    console.log(`[SUBSCRIPTION SERVICE ADMIN] Updating subscription for user ${userId}:`, {
      isSubscribed: updateData.isSubscribed,
      expiresAt: updateData.expiresAt,
      planType: updateData.planType,
      stripeCustomerId: updateData.stripeCustomerId,
      stripeSubscriptionId: updateData.stripeSubscriptionId,
    });
    
    // Use set with merge to ensure all fields are updated
    await subscriptionRef.set(updateData, { merge: true });
    
    // Verify the write succeeded - read it back immediately
    const verifySnap = await subscriptionRef.get();
    if (verifySnap.exists) {
      const verifyData = verifySnap.data();
      const verifiedIsSubscribed = verifyData?.isSubscribed === true;
      console.log(`[SUBSCRIPTION SERVICE ADMIN] ✅ Verification - Document exists with isSubscribed: ${verifiedIsSubscribed} (type: ${typeof verifyData?.isSubscribed}, value: ${verifyData?.isSubscribed})`);
      
      // Double-check: if we set isSubscribed to true but it's not true in the document, something is wrong
      if (updateData.isSubscribed === true && !verifiedIsSubscribed) {
        console.error(`[SUBSCRIPTION SERVICE ADMIN] ❌ CRITICAL: Set isSubscribed=true but document shows ${verifyData?.isSubscribed}! Retrying...`);
        // Retry with explicit true
        await subscriptionRef.set({ isSubscribed: true }, { merge: true });
        const retrySnap = await subscriptionRef.get();
        const retryData = retrySnap.data();
        console.log(`[SUBSCRIPTION SERVICE ADMIN] Retry result - isSubscribed: ${retryData?.isSubscribed}`);
      }
    } else {
      console.error(`[SUBSCRIPTION SERVICE ADMIN] ❌ Verification failed - Document does not exist after write!`);
    }
    
    console.log(`[SUBSCRIPTION SERVICE ADMIN] ✅ Successfully updated subscription for user ${userId}`);
  } catch (error) {
    console.error(`[SUBSCRIPTION SERVICE ADMIN] Error updating subscription status for user ${userId}:`, error);
    throw error;
  }
}
