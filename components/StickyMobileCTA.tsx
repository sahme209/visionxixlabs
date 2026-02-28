"use client";

import Link from "next/link";

export function StickyMobileCTA() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <Link
        href="/contact?subject=Free%20Cloud%20Health%20Snapshot"
        className="block w-full text-center py-3 px-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold text-sm shadow-lg"
      >
        Free Cloud Health Snapshot →
      </Link>
    </div>
  );
}
