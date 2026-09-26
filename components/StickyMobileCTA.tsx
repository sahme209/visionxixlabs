"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function StickyMobileCTA() {
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  if (dismissed || pathname.startsWith("/download")) return null;

  return (
    <>
      <div className="md:hidden h-[calc(4.25rem+env(safe-area-inset-bottom))]" aria-hidden />
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 animate-slide-up-enter">
        <div
          className="px-3 pt-3 bg-[#09090b]/90 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="relative flex items-center gap-2">
            <Link
              href="/download"
              className="cta-shimmer-btn btn-huly flex min-h-11 flex-1 items-center justify-center text-center py-3 px-4 text-zinc-900 rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              Download Axiom Agent
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/70 transition-colors"
              aria-label="Dismiss download shortcut"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
