"use client";

import Link from "next/link";

export function StickyMobileCTA() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.06]">
      <Link
        href="/operator/onboarding"
        className="btn-huly block w-full text-center py-3 px-4 bg-white text-zinc-900 rounded-xl font-semibold text-sm hover:bg-zinc-100 transition-colors shadow-sm"
      >
        Run Axiom — scan your cloud free
      </Link>
    </div>
  );
}
