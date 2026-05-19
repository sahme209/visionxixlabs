"use client";

/**
 * /dashboard/onboarding — first-run wizard.
 *
 * Reads /api/onboarding/checklist and walks the operator through 7
 * env-driven setup steps. Each step shows live status, exact env
 * vars to set, and a deep-link into Help & Docs for context.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RocketLaunchIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

type Status = "complete" | "partial" | "pending";

interface Step {
  id: string;
  order: number;
  label: string;
  description: string;
  status: Status;
  missingHint?: string;
  helpEntryId?: string;
}

interface Checklist {
  totalSteps: number;
  completeCount: number;
  partialCount: number;
  pendingCount: number;
  completionRatio: number;
  steps: Step[];
  generatedAt: string;
}

const STATUS_TONE: Record<Status, string> = {
  complete: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  partial:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  pending:  "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const STATUS_ICON: Record<Status, typeof CheckCircleIcon> = {
  complete: CheckCircleIcon,
  partial:  MinusCircleIcon,
  pending:  ExclamationCircleIcon,
};

export default function OnboardingPage() {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/onboarding/checklist", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Checklist; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setChecklist(j.data);
        else setError(j.error?.userMessage ?? "Onboarding unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const pct = checklist ? Math.round(checklist.completionRatio * 100) : 0;

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(34,211,238,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <RocketLaunchIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              First-Run Wizard · setup_review_only_no_execution
            </span>
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Re-check
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Get to <span className="text-gradient">live</span> in 7 steps.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Each step is a live env check. Set the variables, redeploy, then come back — the page tells you
          exactly which step still needs you.
        </p>

        {checklist && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5">
              <span>{checklist.completeCount}/{checklist.totalSteps} complete · {checklist.partialCount} partial · {checklist.pendingCount} pending</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full border border-white/[0.08] bg-black/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {checklist && (
        <div className="space-y-3 mb-8">
          {checklist.steps.map((s) => {
            const Icon = STATUS_ICON[s.status];
            return (
              <div key={s.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3">
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${
                  s.status === "complete" ? "text-emerald-300" : s.status === "partial" ? "text-amber-300" : "text-rose-300"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-mono text-zinc-500">step {s.order}</span>
                    <p className="text-[14px] font-semibold text-white">{s.label}</p>
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_TONE[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{s.description}</p>
                  {s.missingHint && (
                    <div className="mt-2 rounded-md border border-amber-500/15 bg-amber-500/[0.04] p-2">
                      <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-0.5">// missing</p>
                      <p className="text-[11px] text-amber-100">{s.missingHint}</p>
                    </div>
                  )}
                  {s.helpEntryId && (
                    <Link
                      href={`/dashboard/help?focus=${s.helpEntryId}`}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      Read the docs <ArrowRightIcon className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
