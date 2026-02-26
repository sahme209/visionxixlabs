"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { ExclamationTriangleIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

/**
 * Banner at top of app when subscription is past_due or unpaid.
 * Prompts user to update payment method via Stripe Customer Portal.
 */
export default function PastDueBanner() {
  const { user } = useAuth();
  const { status, loading } = useSubscription();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const isPastDue =
    status.status === "past_due" || status.status === "unpaid";

  if (!user || loading || !isPastDue) {
    return null;
  }

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    try {
      const { getIdToken } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      const token = await getIdToken(user);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnUrl: `${baseUrl}/settings` }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to open billing");
      }
    } catch (err: any) {
      console.error("[PastDueBanner] Error:", err);
      alert(err.message || "Failed to open billing. Please try again.");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  return (
    <div className="sticky top-0 z-[60] bg-orange-500 border-b-2 border-orange-600 shadow-lg">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ExclamationTriangleIcon className="w-6 h-6 text-orange-950 flex-shrink-0" />
            <p className="text-sm font-semibold text-orange-950">
              Payment failed. Please update your payment method to continue.
            </p>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={isOpeningPortal}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-950 text-white text-sm font-semibold hover:bg-orange-900 disabled:opacity-70 transition-colors flex-shrink-0"
          >
            {isOpeningPortal ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <CreditCardIcon className="w-4 h-4" />
                Manage Subscription
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
