import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "../firebase";
import { User } from "firebase/auth";

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
  lastChecked?: Date;
  /**
   * Stripe subscription.status – used for UI and gating logic.
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

/** Infer hasUsedTrial: explicit flag OR any sign of prior subscription (returning user = no new trial) */
function inferHasUsedTrial(data: Record<string, unknown>): boolean {
  if (data.hasUsedTrial === true) return true;
  const hasStripeCustomer = typeof data.stripeCustomerId === "string" && (data.stripeCustomerId as string).length > 0;
  const hasStripeSubId = !!data.stripeSubscriptionId;
  const hadSubscriptionActivity = ["canceled", "active", "trialing", "past_due", "unpaid"].includes(data.status as string);
  const hadExpiresAt = !!data.expiresAt;
  return hasStripeCustomer || hasStripeSubId || hadSubscriptionActivity || hadExpiresAt;
}

/**
 * Check if user has an active subscription
 * Checks Firestore first, then validates with Stripe if needed
 */
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  try {
    const subscriptionRef = doc(db, "subscriptions", userId);
    const subscriptionSnap = await getDoc(subscriptionRef);

    if (!subscriptionSnap.exists()) {
      return { isSubscribed: false };
    }

    const data = subscriptionSnap.data();
    
    // New-style status field from Stripe (trialing/active/past_due/canceled)
    const lifecycleStatus = data.status as SubscriptionLifecycleStatus | undefined;

    // Check isSubscribed flag first (most reliable legacy gate)
    const isSubscribedFlag = data.isSubscribed === true;
    
    // Handle both Firestore Timestamp and Date objects
    let expiresAt: Date | null = null;
    if (data.expiresAt) {
      if (data.expiresAt.toDate) {
        expiresAt = data.expiresAt.toDate();
      } else if (data.expiresAt instanceof Date) {
        expiresAt = data.expiresAt;
      } else if (typeof data.expiresAt === 'string' || typeof data.expiresAt === 'number') {
        expiresAt = new Date(data.expiresAt);
      }
    }

    // trialEnd
    let trialEnd: Date | null = null;
    if (data.trialEnd) {
      if (data.trialEnd.toDate) {
        trialEnd = data.trialEnd.toDate();
      } else if (data.trialEnd instanceof Date) {
        trialEnd = data.trialEnd;
      } else if (typeof data.trialEnd === "string" || typeof data.trialEnd === "number") {
        trialEnd = new Date(data.trialEnd);
      }
    }

    // currentPeriodEnd
    let currentPeriodEnd: Date | null = null;
    if (data.currentPeriodEnd) {
      if (data.currentPeriodEnd.toDate) {
        currentPeriodEnd = data.currentPeriodEnd.toDate();
      } else if (data.currentPeriodEnd instanceof Date) {
        currentPeriodEnd = data.currentPeriodEnd;
      } else if (typeof data.currentPeriodEnd === "string" || typeof data.currentPeriodEnd === "number") {
        currentPeriodEnd = new Date(data.currentPeriodEnd);
      }
    }

    const hasUsedTrial = inferHasUsedTrial(data);

    // New gating: treat trialing/active as subscribed
    const lifecycleSubscribed =
      lifecycleStatus === "trialing" || lifecycleStatus === "active";

    // If isSubscribed flag OR lifecycle status says subscribed, trust it
    if (isSubscribedFlag === true || lifecycleSubscribed) {
      console.log(`[checkSubscriptionStatus] ✅ User ${userId} has active subscription (flag: true), expires: ${expiresAt ? expiresAt.toISOString() : 'N/A'}`);
      return {
        isSubscribed: true,
        planType: data.planType,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        expiresAt: expiresAt || undefined,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
        status: lifecycleStatus,
        trialEnd: trialEnd || undefined,
        currentPeriodEnd: currentPeriodEnd || undefined,
        hasUsedTrial,
        lastChecked: new Date(),
      };
    }

    // If subscription is cancelled but expiresAt is in the future, grant access until then
    if (expiresAt && expiresAt > new Date()) {
      console.log(`[checkSubscriptionStatus] ✅ User ${userId} subscription cancelled but still has access until ${expiresAt.toISOString()}`);
      return {
        isSubscribed: true, // Grant access until expiresAt
        planType: data.planType,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        expiresAt: expiresAt,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
        status: lifecycleStatus,
        trialEnd: trialEnd || undefined,
        currentPeriodEnd: currentPeriodEnd || undefined,
        hasUsedTrial,
        lastChecked: new Date(),
      };
    }

    // Check if subscription has cancelAtPeriodEnd flag or stripeSubscriptionId - might need to restore
    const hasCancelFlag = data.cancelAtPeriodEnd === true;
    const stripeSubscriptionIdValue = typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : undefined;
    const hasStripeId = !!stripeSubscriptionIdValue;
    
    console.log(`[checkSubscriptionStatus] ❌ User ${userId} subscription not active. isSubscribed: ${isSubscribedFlag}, type: ${typeof isSubscribedFlag}, expiresAt: ${expiresAt ? expiresAt.toISOString() : 'null'}, cancelAtPeriodEnd: ${hasCancelFlag}, stripeSubscriptionId: ${stripeSubscriptionIdValue || 'none'}`);
    
    // Return subscription info even if inactive, so UI can show restore button if needed
    return { 
      isSubscribed: false,
      planType: data.planType,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionIdValue,
      expiresAt: expiresAt || undefined,
      cancelAtPeriodEnd: hasCancelFlag,
      status: lifecycleStatus,
      trialEnd: trialEnd || undefined,
      currentPeriodEnd: currentPeriodEnd || undefined,
      hasUsedTrial,
    };
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return { isSubscribed: false };
  }
}

/**
 * Subscribe to subscription status changes
 */
export function subscribeToSubscriptionStatus(
  userId: string,
  callback: (status: SubscriptionStatus) => void
): Unsubscribe {
  const subscriptionRef = doc(db, "subscriptions", userId);

  return onSnapshot(
    subscriptionRef,
    (snap) => {
      if (!snap.exists()) {
        callback({ isSubscribed: false });
        return;
      }

      const data = snap.data();
      
      // New-style status field from Stripe
      const lifecycleStatus = data.status as SubscriptionLifecycleStatus | undefined;

      // Check isSubscribed flag first (most reliable legacy gate)
      const isSubscribedFlag = data.isSubscribed === true;
      
      // Handle both Firestore Timestamp and Date objects
      let expiresAt: Date | null = null;
      if (data.expiresAt) {
        if (data.expiresAt.toDate) {
          expiresAt = data.expiresAt.toDate();
        } else if (data.expiresAt instanceof Date) {
          expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'string' || typeof data.expiresAt === 'number') {
          expiresAt = new Date(data.expiresAt);
        }
      }

      // trialEnd
      let trialEnd: Date | null = null;
      if (data.trialEnd) {
        if (data.trialEnd.toDate) {
          trialEnd = data.trialEnd.toDate();
        } else if (data.trialEnd instanceof Date) {
          trialEnd = data.trialEnd;
        } else if (typeof data.trialEnd === "string" || typeof data.trialEnd === "number") {
          trialEnd = new Date(data.trialEnd);
        }
      }

      // currentPeriodEnd
      let currentPeriodEnd: Date | null = null;
      if (data.currentPeriodEnd) {
        if (data.currentPeriodEnd.toDate) {
          currentPeriodEnd = data.currentPeriodEnd.toDate();
        } else if (data.currentPeriodEnd instanceof Date) {
          currentPeriodEnd = data.currentPeriodEnd;
        } else if (typeof data.currentPeriodEnd === "string" || typeof data.currentPeriodEnd === "number") {
          currentPeriodEnd = new Date(data.currentPeriodEnd);
        }
      }

      const hasUsedTrial = inferHasUsedTrial(data);

      const lifecycleSubscribed =
        lifecycleStatus === "trialing" || lifecycleStatus === "active";

      // If isSubscribed flag OR lifecycle status says subscribed, trust it
      if (isSubscribedFlag === true || lifecycleSubscribed) {
        console.log(`[subscribeToSubscriptionStatus] ✅ User ${userId} subscription active (flag: true), expires: ${expiresAt ? expiresAt.toISOString() : 'N/A'}`);
        callback({
          isSubscribed: true,
          planType: data.planType,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          expiresAt: expiresAt || undefined,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
          status: lifecycleStatus,
          trialEnd: trialEnd || undefined,
          currentPeriodEnd: currentPeriodEnd || undefined,
          hasUsedTrial,
          lastChecked: new Date(),
        });
      } else if (expiresAt && expiresAt > new Date()) {
        // If subscription is cancelled but expiresAt is in the future, grant access until then
        console.log(`[subscribeToSubscriptionStatus] ✅ User ${userId} subscription cancelled but still has access until ${expiresAt.toISOString()}`);
        callback({
          isSubscribed: true, // Grant access until expiresAt
          planType: data.planType,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          expiresAt: expiresAt,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
          status: lifecycleStatus,
          trialEnd: trialEnd || undefined,
          currentPeriodEnd: currentPeriodEnd || undefined,
          hasUsedTrial,
          lastChecked: new Date(),
        });
      } else {
        // Check if subscription has cancelAtPeriodEnd flag or stripeSubscriptionId - might need to restore
        const hasCancelFlag = data.cancelAtPeriodEnd === true;
        // Handle stripeSubscriptionId - it should be a string, but check for boolean true (data issue)
        // If it's boolean true, return it as truthy so UI can show restore button, but API will fetch actual ID from Stripe
        const stripeSubscriptionIdValue = typeof data.stripeSubscriptionId === 'string' 
          ? data.stripeSubscriptionId 
          : (data.stripeSubscriptionId === true ? true as any : undefined); // Keep truthy value for UI check
        const hasStripeId = !!data.stripeSubscriptionId;
        
        console.log(`[subscribeToSubscriptionStatus] ❌ User ${userId} subscription not active. isSubscribed: ${isSubscribedFlag}, type: ${typeof isSubscribedFlag}, expiresAt: ${expiresAt ? expiresAt.toISOString() : 'null'}, cancelAtPeriodEnd: ${hasCancelFlag}, stripeSubscriptionId type: ${typeof data.stripeSubscriptionId}, value: ${typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : data.stripeSubscriptionId}`);
        
        // Return subscription info even if inactive, so UI can show restore button if needed
        callback({ 
          isSubscribed: false,
          planType: data.planType,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: stripeSubscriptionIdValue,
          expiresAt: expiresAt || undefined,
          cancelAtPeriodEnd: hasCancelFlag,
          status: lifecycleStatus,
          trialEnd: trialEnd || undefined,
          currentPeriodEnd: currentPeriodEnd || undefined,
          hasUsedTrial,
        });
      }
    },
    (error) => {
      console.error("Error subscribing to subscription status:", error);
      callback({ isSubscribed: false });
    }
  );
}

/**
 * Update subscription status (called by webhook)
 */
export async function updateSubscriptionStatus(
  userId: string,
  status: {
    isSubscribed: boolean;
    planType?: "monthly" | "annual";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    expiresAt?: Date;
  }
): Promise<void> {
  try {
    const subscriptionRef = doc(db, "subscriptions", userId);
    const updateData: any = {
      isSubscribed: status.isSubscribed,
      lastUpdated: new Date(),
    };
    
    if (status.planType) updateData.planType = status.planType;
    if (status.stripeCustomerId) updateData.stripeCustomerId = status.stripeCustomerId;
    if (status.stripeSubscriptionId) updateData.stripeSubscriptionId = status.stripeSubscriptionId;
    
    // Handle expiresAt - convert to Firestore Timestamp if it's a Date
    if (status.expiresAt) {
      const { Timestamp } = await import("firebase/firestore");
      if (status.expiresAt instanceof Date) {
        updateData.expiresAt = Timestamp.fromDate(status.expiresAt);
      } else {
        updateData.expiresAt = status.expiresAt;
      }
    } else {
      updateData.expiresAt = null;
    }
    
    console.log(`[SUBSCRIPTION SERVICE] Updating subscription for user ${userId}:`, {
      isSubscribed: updateData.isSubscribed,
      expiresAt: updateData.expiresAt,
      planType: updateData.planType,
    });
    
    await setDoc(subscriptionRef, updateData, { merge: true });
    
    console.log(`[SUBSCRIPTION SERVICE] Successfully updated subscription for user ${userId}`);
  } catch (error) {
    console.error(`[SUBSCRIPTION SERVICE] Error updating subscription status for user ${userId}:`, error);
    throw error;
  }
}
