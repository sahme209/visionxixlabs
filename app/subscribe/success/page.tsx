"use client";

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import { checkSubscriptionStatus } from "@/lib/services/subscriptionService";
import { useSubscription } from "@/hooks/useSubscription";
import { HERO_IMAGES } from "@/lib/images";

function SubscribeSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Verify the session directly with Stripe API and wait for subscription to be confirmed
    const verifyAndWaitForSubscription = async () => {
      if (!sessionId || !user || verifying) return;
      
      setVerifying(true);
      try {
        console.log(`[SUCCESS PAGE] Verifying session directly with Stripe...`);
        
        // Step 1: Verify session and update Firestore
        const response = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userId: user.uid }),
        });

        if (!response.ok) {
          console.error(`[SUCCESS PAGE] Failed to verify session`);
          throw new Error("Failed to verify session");
        }

        console.log(`[SUCCESS PAGE] Session verified! Waiting for subscription to be active...`);

        // Step 2: Poll until subscription is confirmed in Firestore
        let attempts = 0;
        const maxAttempts = 20; // Wait up to 20 seconds
        const pollInterval = 500; // Check every 500ms for faster response
        
        const waitForSubscription = async (): Promise<boolean> => {
          const status = await checkSubscriptionStatus(user.uid);
          console.log(`[SUCCESS PAGE] Subscription check attempt ${attempts + 1}/${maxAttempts}:`, {
            isSubscribed: status.isSubscribed,
            planType: status.planType,
            expiresAt: status.expiresAt?.toISOString(),
          });
          
          if (status.isSubscribed) {
            console.log(`[SUCCESS PAGE] ✅ Subscription confirmed! isSubscribed: true`);
            return true;
          }
          
          if (attempts >= maxAttempts) {
            console.log(`[SUCCESS PAGE] ⚠️ Max attempts reached. Checking Firestore directly...`);
            // Last resort: check Firestore directly
            try {
              const { doc, getDoc } = await import("firebase/firestore");
              const { db } = await import("@/lib/firebase");
              const subscriptionRef = doc(db, "subscriptions", user.uid);
              const subscriptionSnap = await getDoc(subscriptionRef);
              if (subscriptionSnap.exists()) {
                const data = subscriptionSnap.data();
                console.log(`[SUCCESS PAGE] Firestore data:`, data);
                if (data.isSubscribed === true) {
                  console.log(`[SUCCESS PAGE] ✅ Found isSubscribed: true in Firestore!`);
                  return true;
                }
              }
            } catch (err) {
              console.error(`[SUCCESS PAGE] Error checking Firestore:`, err);
            }
            console.log(`[SUCCESS PAGE] ⚠️ Proceeding anyway - real-time listener will update it`);
            return false; // Proceed anyway - real-time listener will update it
          }
          
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          return waitForSubscription();
        };

        // Wait for subscription to be confirmed
        const confirmed = await waitForSubscription();
        
        if (confirmed) {
          console.log(`[SUCCESS PAGE] ✅ Subscription is active! Redirecting to dashboard...`);
        } else {
          console.log(`[SUCCESS PAGE] ⚠️ Subscription not yet confirmed, but redirecting (real-time listener will update)`);
        }
        
        // Step 3: Set loading to false and redirect
        setLoading(false);
        
        // Simple redirect - real-time listener will update subscription status
        setTimeout(() => {
          router.push("/");
        }, 500);
        
      } catch (error) {
        console.error(`[SUCCESS PAGE] Error verifying session:`, error);
        // Still try to redirect after a delay - subscription might update via webhook
        setLoading(false);
        setTimeout(() => router.push("/"), 2000);
      } finally {
        setVerifying(false);
      }
    };

    if (sessionId && user) {
      verifyAndWaitForSubscription();
    } else if (!sessionId) {
      router.push("/subscribe");
    } else if (!user) {
      setLoading(false);
    }
  }, [sessionId, router, user, verifying]);

  // Watch for subscription status changes via hook (backup in case polling doesn't catch it)
  useEffect(() => {
    if (isSubscribed && !subscriptionLoading && !loading) {
      console.log(`[SUCCESS PAGE] Subscription status updated via hook! isSubscribed: true`);
      // Don't redirect again if we're already redirecting
    }
  }, [isSubscribed, subscriptionLoading, loading]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--uscis-blue)] mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)] text-sm">
            {verifying ? "Activating your subscription..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08]">
        <Image src={HERO_IMAGES.statueOfLiberty} alt="" fill className="object-cover" sizes="100vw" />
      </div>
      <div className="relative z-10 max-w-md w-full bg-[var(--bg-surface)] rounded-2xl p-8 text-center uscis-card overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]">
          <Image src={HERO_IMAGES.usFlag} alt="" fill className="object-cover" sizes="600px" />
        </div>
        <div className="relative">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
          <CheckIcon className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Welcome to Premium!
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          Your subscription is now active. You have access to all premium features.
        </p>
        <Link href="/" className="uscis-button inline-block">
          Go to Dashboard
        </Link>
        </div>
      </div>
    </div>
  );
}

export default function SubscribeSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--uscis-blue)]"></div>
      </div>
    }>
      <SubscribeSuccessContent />
    </Suspense>
  );
}
