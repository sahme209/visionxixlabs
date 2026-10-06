"use client";

/**
 * ContextualHelpBubble — floating "?" button on every dashboard page.
 *
 * Looks up the current route in the help index and renders a small
 * popover with the matching entry's description + requirements +
 * deep-link into /dashboard/help. No external dependencies.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QuestionMarkCircleIcon, XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { resolveHelpForPath } from "@/lib/help/helpRouteIndex";

export function ContextualHelpBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(true);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const entry = useMemo(() => resolveHelpForPath(pathname ?? ""), [pathname]);

  // Phase 127 — honor the per-tenant ui.contextual_help_bubble flag.
  // Optimistic default of `true` avoids a flicker; flip to false only
  // when the public flag endpoint explicitly says so.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/flags/public", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: { flags?: Record<string, boolean> } }) => {
        if (cancelled) return;
        const flag = j.data?.flags?.["ui.contextual_help_bubble"];
        if (flag === false) setEnabled(false);
      })
      .catch(() => { /* leave optimistic default */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Close on Escape, returning focus to the trigger button rather
    // than dropping it — same rule as the other floating widgets.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    // Close on outside click.
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      window.addEventListener("mousedown", onClick);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!enabled) return null;

  return (
    <div ref={wrapperRef} className="fixed bottom-5 right-5 z-40">
      {open && (
        <div role="dialog" aria-label="Help" className="mb-2 w-[320px] rounded-2xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur shadow-2xl p-4 text-left">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[10px] font-mono text-cyan-300/80 uppercase tracking-wider">// help</p>
            <button onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="text-zinc-400 hover:text-white">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          {entry ? (
            <>
              <p className="text-[13px] font-semibold text-white">{entry.title}</p>
              <p className="text-[11px] text-zinc-300 leading-relaxed mt-1">{entry.description}</p>
              {entry.requirements.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300 uppercase tracking-wider">
                    {entry.requirements.length} requirement{entry.requirements.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-1 space-y-0.5 text-[10px] text-zinc-400">
                    {entry.requirements.map((r, i) => <p key={i}>· {r}</p>)}
                  </div>
                </details>
              )}
              {entry.safetyContract && (
                <p className="mt-2 text-[9px] font-mono text-emerald-300/80 uppercase tracking-wider">
                  safetyContract · {entry.safetyContract}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-white">Need a hand?</p>
              <p className="text-[11px] text-zinc-300 leading-relaxed mt-1">
                No entry mapped for this exact route. Browse the help library or search by topic.
              </p>
            </>
          )}
          <Link
            href={entry ? `/dashboard/help?focus=${entry.id}` : "/dashboard/help"}
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-200 hover:text-cyan-100"
          >
            Open Help & Docs <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      )}

      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Help"
        aria-expanded={open}
        className="rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/30 p-2 shadow-lg backdrop-blur transition"
      >
        <QuestionMarkCircleIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
