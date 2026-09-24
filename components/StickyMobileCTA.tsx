"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function StickyMobileCTA() {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (dismissed || !mounted) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 animate-slide-up-enter">
      <div className="p-3 bg-[#09090b]/80 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
        <div className="relative flex items-center gap-2">
          <Link
            href="/download"
            className="cta-shimmer-btn btn-huly block flex-1 text-center py-3 px-4 text-zinc-900 rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            Download Axiom — operate from desktop
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.1] transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
