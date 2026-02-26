"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

/** 24 hours in ms */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Shows in-app reminder when trial ends within 24 hours.
 */
export default function TrialReminderBanner() {
  const { status, loading, isTrialing } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (loading || !isTrialing || dismissed) {
    return null;
  }

  const trialEnd = status.trialEnd;
  if (!trialEnd) return null;

  const trialEndDate =
    trialEnd instanceof Date ? trialEnd : new Date(trialEnd);
  const now = new Date();
  const hoursUntilEnd = (trialEndDate.getTime() - now.getTime()) / (60 * 60 * 1000);

  if (hoursUntilEnd > 24 || hoursUntilEnd < 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-[55] bg-blue-600 border-b-2 border-blue-700 shadow-lg">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-white">
            Your trial ends {hoursUntilEnd < 1 ? "soon" : "tomorrow"}. You will be charged $4.99/month.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/settings"
              className="px-4 py-2 rounded-lg bg-white text-gray-800 text-sm font-semibold hover:bg-blue-50 transition-colors"
            >
              Manage Subscription
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded hover:bg-white/20 text-white transition-colors"
              aria-label="Dismiss"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
