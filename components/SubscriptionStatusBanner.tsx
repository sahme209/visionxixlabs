"use client";

import React from "react";
import { useState } from "react";
import Link from "next/link";
import { XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { LockClosedIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/contexts/AuthContext";
import { checkSubscriptionStatus } from "@/lib/services/subscriptionService";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionStatusBannerProps {
  onRefresh?: () => void;
}

export default function SubscriptionStatusBanner({ onRefresh }: SubscriptionStatusBannerProps) {
  const { user } = useAuth();
  const { isSubscribed, loading, hasUsedTrial } = useSubscription();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleManualRefresh = async () => {
    if (!user) return;

    setIsRefreshing(true);
    try {
      await checkSubscriptionStatus(user.uid);
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const subscriptionRef = doc(db, "subscriptions", user.uid);
      const subscriptionSnap = await getDoc(subscriptionRef);
      if (subscriptionSnap.exists()) {
        const data = subscriptionSnap.data();
        console.log(`[BANNER] Firestore data:`, data);
      }
      window.location.reload();
    } catch (error) {
      console.error("[BANNER] Error refreshing subscription:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isSubscribed || loading || dismissed) {
    return null;
  }

  return (
    <div
      className="sticky top-0 z-[60] border-b border-white/15 shadow-lg"
      style={{
        background: "linear-gradient(135deg, var(--hero-dark) 0%, var(--hero-dark-soft) 50%, var(--hero-dark) 100%)",
      }}
    >
      {/* Top accent line */}
      <div
        className="h-0.5 opacity-90"
        style={{
          background: "linear-gradient(90deg, var(--uscis-blue) 0%, var(--uscis-blue-light) 50%, var(--uscis-blue) 100%)",
        }}
        aria-hidden
      />

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-3.5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {/* Copy - no overlap: min-w-0 so text wraps inside */}
          <div className="flex items-start gap-3 flex-1 min-w-0 shrink-0 sm:min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <LockClosedIcon className="w-5 h-5 sm:w-4 sm:h-4" style={{ color: "#fff" }} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="text-base sm:text-sm font-semibold leading-tight break-words" style={{ color: "#fff" }}>
                Know where you stand.
              </p>
              <p className="text-sm sm:text-xs leading-snug mt-0.5 break-words" style={{ color: "#fff" }}>
                Unlock timelines, estimates, and real-time updates.
              </p>
            </div>
          </div>

          {/* Actions - mobile: stacked so CTA full-width, no overlap */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 flex-shrink-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 order-2 sm:order-1">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-0 sm:px-4 sm:py-2.5 flex items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-sm font-medium transition-colors disabled:opacity-50 touch-manipulation active:scale-[0.98]"
                style={{ color: "#fff" }}
                title="Refresh subscription status"
                aria-label={isRefreshing ? "Refreshing" : "Refresh subscription status"}
              >
                <ArrowPathIcon
                  className={`w-5 h-5 sm:w-4 sm:h-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`}
                  style={{ color: "#fff" }}
                  aria-hidden
                />
                <span className="hidden sm:inline" style={{ color: "#fff" }}>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/15 transition-colors touch-manipulation"
                style={{ color: "#fff" }}
                aria-label="Dismiss banner"
              >
                <XMarkIcon className="w-5 h-5 sm:w-5 sm:h-5" style={{ color: "#fff" }} aria-hidden />
              </button>
            </div>
            <Link
              href="/subscribe"
              className="subscribe-cta-banner min-h-[48px] sm:min-h-[44px] w-full sm:w-auto sm:flex-initial order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold hover:opacity-95 active:scale-[0.98] transition-all touch-manipulation border border-white/20 shadow-md"
              style={{ backgroundColor: "var(--uscis-blue)", color: "#fff" }}
            >
              <span style={{ color: "#fff" }}>{hasUsedTrial ? "Subscribe Now" : "Start 3-day free trial"}</span>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} style={{ color: "#fff" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
