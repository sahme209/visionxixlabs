"use client";

import Link from "next/link";

export function StickyMobileCTA() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700">
      <Link
        href="/operator/onboarding"
        className="block w-full text-center py-3 px-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-semibold text-sm"
      >
        Run Axiom — scan your cloud free
      </Link>
    </div>
  );
}
