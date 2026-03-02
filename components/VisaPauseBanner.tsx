"use client";

import React from "react";
import Link from "next/link";

/** Top banner: CLINIC v. Rubio | Visa Pause Impact — shown for everyone (logged in or not). */
export default function VisaPauseBanner() {
  return (
    <Link
      href="/visa-pause-impact"
      className="block w-full bg-[#0078D4] hover:bg-[#106EBE] transition-colors duration-200 border-b border-[#0078D4]/20"
    >
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold tracking-wide uppercase text-white">
                CLINIC v. Rubio
              </span>
              <span>Visa Pause Impact Center</span>
            </span>
          </div>
          <span className="text-xs text-white/90 hidden sm:inline">
            Track recovery & see how delays affect your case
          </span>
          <svg className="w-4 h-4 ml-auto text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
