"use client";

/**
 * Dashboard-scope error boundary.
 *
 * Next.js wires this automatically when any route in /dashboard/**
 * throws during render. We render a typed, branded fallback with a
 * Reset button + a link back to the Command Center. Never echoes the
 * raw stack — operators see a hash they can quote to support.
 */

import { useEffect } from "react";
import Link from "next/link";
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from "@heroicons/react/24/outline";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface a one-line console error for browser-side debugging;
    // production stacks already land in the Vercel runtime log.
    // eslint-disable-next-line no-console
    console.error("[dashboard] route threw:", error?.message);
  }, [error]);

  const digest = error?.digest ?? "no-digest";

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(244,63,94,0.12), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-400/[0.18] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/[0.06] px-2.5 py-1">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              Route error · safety contract preserved
            </span>
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] leading-[1.1] mb-3">
          This dashboard panel hit an error.
        </h1>
        <p className="text-[14px] text-zinc-300 max-w-2xl leading-relaxed">
          The autonomy loop, cron schedulers, and audit writers are unaffected — those run server-side and stay
          read-only by contract. Refreshing the page often resolves the issue. If it persists, quote the digest
          below when reaching out.
        </p>

        <div className="mt-5 rounded-lg border border-white/[0.08] bg-black/30 p-3 font-mono text-[11px] text-zinc-300">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">// error digest</p>
          <code>{digest}</code>
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Reset this panel
          </button>
          <Link
            href="/dashboard/command-center"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-200 border border-white/[0.08] hover:bg-white/[0.08]"
          >
            <HomeIcon className="h-3.5 w-3.5" />
            Back to Command Center
          </Link>
          <Link
            href="/dashboard/self-diagnostic"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-200 border border-white/[0.08] hover:bg-white/[0.08]"
          >
            Run self-diagnostic
          </Link>
        </div>
      </div>
    </div>
  );
}
