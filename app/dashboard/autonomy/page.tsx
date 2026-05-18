"use client";

/**
 * /dashboard/autonomy — Closed Autonomy Loop Cockpit.
 *
 * Per-cycle visualisation of the 9-stage typed autonomy loop. Every
 * candidate's stage transcript is honest: which stage halted it,
 * why, and where the evidence lives. The page can run cycles in
 * each of the 4 charter modes (observer → autonomous). The loop
 * never executes — execution always routes through the paired
 * desktop runtime.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

type Mode = "observer" | "review" | "assisted" | "autonomous";

const STAGES = ["detect", "reason", "simulate", "policy_gate", "boundary", "approve", "execute", "verify", "audit"] as const;
type Stage = typeof STAGES[number];
type StageStatus =
  | "passed" | "halted_safe" | "halted_policy" | "halted_boundary"
  | "halted_missing_evidence" | "halted_unsafe" | "halted_needs_human"
  | "not_reached" | "errored";

interface StageResult {
  stage: Stage;
  status: StageStatus;
  summary: string;
  reason?: string;
  evidenceRef: string;
}

interface Candidate {
  id: string;
  rank: number;
  title: string;
  proposedIntent: string;
  boundaryClass: string;
  stages: StageResult[];
  outcome: string;
  evidenceRefs: string[];
  limitations: string[];
}

interface CycleReport {
  generatedAt: string;
  charter: { mode: Mode; allowedClasses: string[]; perCycleActionLimit: number; rationale: string };
  candidates: Candidate[];
  cycleStatus: string;
  summary: {
    candidatesConsidered: number;
    candidatesDeferred: number;
    approvalPacketsPrepared: number;
    executionsHandedOff: number;
    verifiedComplete: number;
    haltedAtGate: number;
    erroredCount: number;
    stageRollup: Record<StageStatus, number>;
  };
  nextCycleEligibleAt: string;
  safetyContract: "autonomy_gated_no_unsafe_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const STAGE_STATUS_VISUAL: Record<StageStatus, { pill: string; icon: typeof CheckCircleIcon; label: string }> = {
  passed:                  { pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon,         label: "passed" },
  halted_safe:             { pill: "bg-cyan-500/15 text-cyan-300",       icon: ClockIcon,               label: "halted · safe" },
  halted_policy:           { pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, label: "halted · policy" },
  halted_boundary:         { pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, label: "halted · boundary" },
  halted_missing_evidence: { pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, label: "halted · evidence" },
  halted_unsafe:           { pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon,             label: "halted · unsafe" },
  halted_needs_human:      { pill: "bg-violet-500/15 text-violet-300",   icon: ClockIcon,               label: "halted · needs human" },
  not_reached:             { pill: "bg-zinc-700/40 text-zinc-300",       icon: MinusCircleIcon,         label: "not reached" },
  errored:                 { pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon,             label: "errored" },
};

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  observer:   "Run the loop to surface decisions. Never auto-approves; operator drives every transition.",
  review:     "Auto-approve read-only / preview / simulation classes. Everything else halts for human review.",
  assisted:   "Auto-approve + hand desktop-reviewable actions to the paired runtime. Mutations halt.",
  autonomous: "Drive policy-gated executions end-to-end. Unsafe + credentialed-disabled classes always halt.",
};

export default function AutonomyCockpitPage() {
  const [mode, setMode] = useState<Mode>("observer");
  const [report, setReport] = useState<CycleReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runCycle = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/autonomy/cycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (json.ok && json.data) setReport(json.data);
      else setError(json.error?.userMessage ?? "Autonomy cycle failed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.08), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CpuChipIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Closed Autonomy Loop · autonomy_gated_no_unsafe_execution
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          The loop decides. <span className="text-gradient">Every gate audits.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Nine typed stages — detect → reason → simulate → policy gate → boundary → approve → execute → verify → audit. Mutations are impossible at the type level. Web never executes; the desktop runtime is the only surface that touches real infrastructure.
        </p>

        {/* Charter selector */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-2">
          {(["observer", "review", "assisted", "autonomous"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  active
                    ? "border-violet-500/40 bg-violet-500/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <p className={`text-[11px] font-mono uppercase tracking-wider ${active ? "text-violet-200" : "text-zinc-400"}`}>{m}</p>
                <p className="text-[11px] text-zinc-400 leading-snug mt-1">{MODE_DESCRIPTIONS[m]}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={runCycle}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 hover:border-emerald-500/60 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12] text-emerald-200 font-medium text-[13px] px-4 py-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Running cycle…" : `Run cycle (${mode})`}
          </button>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last cycle {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// cycle failed</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {report && (
        <>
          {/* Cycle summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
            <Stat label="Considered" value={report.summary.candidatesConsidered} tone="zinc" />
            <Stat label="Deferred" value={report.summary.candidatesDeferred} tone="cyan" />
            <Stat label="Packets" value={report.summary.approvalPacketsPrepared} tone="amber" />
            <Stat label="Handed off" value={report.summary.executionsHandedOff} tone="emerald" />
            <Stat label="Verified" value={report.summary.verifiedComplete} tone="emerald" />
            <Stat label="Halted" value={report.summary.haltedAtGate} tone="rose" />
            <Stat label="Errored" value={report.summary.erroredCount} tone="rose" />
          </div>

          {/* Charter summary */}
          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-4 mb-6">
            <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-[0.18em] mb-1">// active charter</p>
            <p className="text-[13px] text-white font-semibold">{report.charter.mode}</p>
            <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">{report.charter.rationale}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {report.charter.allowedClasses.map((c) => (
                <span key={c} className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-200">
                  {c.replace(/_/g, " ")}
                </span>
              ))}
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                limit {report.charter.perCycleActionLimit}/cycle
              </span>
            </div>
          </div>

          {/* Per-candidate transcripts */}
          {report.candidates.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center mb-6">
              <ShieldCheckIcon className="h-6 w-6 text-emerald-300 mx-auto mb-2" />
              <p className="text-[13px] text-zinc-300">No candidates this cycle. Operating loop is idle.</p>
            </div>
          ) : (
            <div className="space-y-3 mb-10">
              {report.candidates.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500">#{c.rank}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">{c.boundaryClass.replace(/_/g, " ")}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">{c.outcome.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight">{c.title}</p>
                      <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5">{c.proposedIntent}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-9 gap-1.5">
                    {c.stages.map((s) => {
                      const v = STAGE_STATUS_VISUAL[s.status];
                      const Icon = v.icon;
                      return (
                        <div key={s.stage} title={`${s.summary}${s.reason ? "\n\n" + s.reason : ""}`} className="rounded-md border border-white/[0.04] bg-white/[0.015] p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Icon className="h-3 w-3 text-white/60 shrink-0" />
                            <span className="text-[9px] font-mono text-zinc-400 truncate">{s.stage.replace(/_/g, " ")}</span>
                          </div>
                          <span className={`block text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded text-center ${v.pill}`}>{v.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contract */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// autonomy contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">{report.limitations.join(" ")}</p>
              <Link href={report.safeNextAction.href} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100">
                {report.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </>
      )}

      {!report && !error && !running && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <CpuChipIcon className="h-6 w-6 text-violet-300 mx-auto mb-2" />
          <p className="text-[13px] text-zinc-300">Pick a charter mode and run a cycle. Nothing executes — the loop only declares intent.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "cyan" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    cyan:    "border-cyan-500/[0.18] bg-cyan-500/[0.03] text-cyan-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[20px] font-bold mt-1">{value}</p>
    </div>
  );
}
