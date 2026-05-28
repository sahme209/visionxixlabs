"use client";

/**
 * Demo-mode banner — Phase 532.
 *
 * Renders at the top of every dashboard surface when the operator is
 * in demo mode (axiom_demo_mode cookie). Lets them:
 *   • see they're in demo mode (no surprise)
 *   • click "what am I looking at?" → toggles a per-surface explainer
 *   • click "exit demo" → cleans up the seeded rows and clears the cookie
 *
 * The explainer state is shared via a query-param-free localStorage
 * flag so a single click flips the explainer overlay across every
 * surface (each page reads `axiom_demo_explainer` to decide whether
 * to render its own <SurfaceExplainer>).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SparklesIcon, QuestionMarkCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  const found = document.cookie.split("; ").find((c) => c.startsWith(target));
  return found ? decodeURIComponent(found.slice(target.length)) : null;
}

export function DemoModeBanner() {
  const router = useRouter();
  const [active, setActive] = useState<boolean | null>(null);
  const [explainerOn, setExplainerOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActive(readCookie("axiom_demo_mode") === "1");
    setExplainerOn(typeof localStorage !== "undefined" && localStorage.getItem("axiom_demo_explainer") === "1");
  }, []);

  function toggleExplainer() {
    const next = !explainerOn;
    setExplainerOn(next);
    try {
      localStorage.setItem("axiom_demo_explainer", next ? "1" : "0");
      // Notify same-tab surfaces that the flag flipped.
      window.dispatchEvent(new Event("axiom-demo-explainer-changed"));
    } catch { /* storage blocked — banner toggle still local */ }
  }

  async function exitDemo() {
    setBusy(true);
    try {
      await fetch("/api/demo/cleanup", { method: "POST", credentials: "include" });
    } catch { /* swallow — UI cleanup runs anyway */ }
    document.cookie = "axiom_demo_mode=; path=/; max-age=0; SameSite=Lax";
    try { localStorage.removeItem("axiom_demo_explainer"); } catch { /* ignore */ }
    router.refresh();
  }

  if (active !== true) return null;

  return (
    <div className="mb-5 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/[0.06] via-fuchsia-500/[0.04] to-transparent">
      <div className="flex items-center gap-3 flex-wrap px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.18em] text-violet-200 px-2 py-1 rounded-full border border-violet-500/30 bg-violet-500/[0.10]">
          <SparklesIcon className="h-3.5 w-3.5" /> demo mode
        </span>
        <p className="text-[12.5px] text-zinc-300 leading-relaxed">
          You&apos;re exploring with synthetic data. Every signal, recommendation, and audit row was seeded for your tenant — nothing here touches a real cloud account.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleExplainer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-violet-500/30 bg-violet-500/[0.08] text-[12px] font-medium text-violet-100 hover:bg-violet-500/[0.16] transition-colors"
          >
            <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
            {explainerOn ? "Hide explainer" : "Explain this page"}
          </button>
          <Link
            href="/dashboard/start-here"
            className="text-[11.5px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            tour ↗
          </Link>
          <button
            type="button"
            onClick={exitDemo}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11.5px] font-mono text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
            aria-label="Exit demo mode"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
            {busy ? "exiting…" : "exit demo"}
          </button>
        </div>
      </div>
    </div>
  );
}
