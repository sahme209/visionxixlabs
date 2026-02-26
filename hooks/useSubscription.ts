import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  checkSubscriptionStatus,
  subscribeToSubscriptionStatus,
  SubscriptionStatus,
} from "@/lib/services/subscriptionService";

export interface UseSubscriptionResult {
  isSubscribed: boolean;
  planType?: "monthly" | "annual";
  loading: boolean;
  status: SubscriptionStatus;
  /**
   * Convenience flag – true when underlying subscription status is trialing.
   */
  isTrialing?: boolean;
  /**
   * True if user already used their 3-day free trial – they should see "Subscribe" not "Start trial".
   */
  hasUsedTrial?: boolean;
}

/**
 * Hook to check and subscribe to user's subscription status
 */
export function useSubscription(): UseSubscriptionResult {
  const { user, loading: authLoading } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isSubscribed: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setSubscriptionStatus({ isSubscribed: false });
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Initial check
    checkSubscriptionStatus(user.uid).then((status) => {
      if (!isMounted) return;
      console.log(`[useSubscription] Initial check for user ${user.uid}:`, {
        isSubscribed: status.isSubscribed,
        expiresAt: status.expiresAt?.toISOString(),
        planType: status.planType,
      });
      setSubscriptionStatus(status);
      setLoading(false);
    });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToSubscriptionStatus(user.uid, (status) => {
      if (!isMounted) return;
      console.log(`[useSubscription] 🔄 Real-time update for user ${user.uid}:`, {
        isSubscribed: status.isSubscribed,
        expiresAt: status.expiresAt?.toISOString(),
        planType: status.planType,
      });
      // Force state update to trigger all component re-renders
      setSubscriptionStatus((prev) => {
        // Always return new object to trigger re-renders
        return {
          ...status,
          lastChecked: new Date(),
        };
      });
      setLoading(false);
    });

    // No periodic refresh - rely on real-time Firestore listener
    // The onSnapshot listener will automatically update when subscription changes

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user, authLoading]);

  const isTrialing = subscriptionStatus.status === "trialing";
  const hasUsedTrial = subscriptionStatus.hasUsedTrial === true;

  return {
    isSubscribed: subscriptionStatus.isSubscribed,
    planType: subscriptionStatus.planType,
    loading: authLoading || loading,
    status: subscriptionStatus,
    isTrialing,
    hasUsedTrial,
  };
}
