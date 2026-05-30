"use client";

/**
 * /dashboard/releaseops-autonomy — Phase 513.
 *
 * Shows what the AGI cron has been doing on its own. Every hour the
 * autonomous tick scans active releases + open incidents + org state
 * and runs the four AGI engines for subjects without a recent run.
 */

import { useEffect, useState } from "react";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface OrgTick {
  id: string;
  totalRuns: number;
  okRuns: number;
  errorRuns: number;
  skippedRuns: number;
  report: {
    advisorRuns: { releaseId: string; outcome: string; reason?: string }[];
    triageRuns: { incidentId: string; outcome: string; reason?: string }[];
    remediationRuns: { incidentId: string; outcome: string; reason?: string }[];
    policyProposalRun: { outcome: string; reason?: string } | null;
  };
  generatedAtIso: string;
}

interface GlobalTick {
  id: string;
  totalRuns: number;
  okRuns: number;
  errorRuns: number;
  skippedRuns: number;
  generatedAtIso: string;
}

interface Data {
  generatedAt: string;
  org: OrgTick[];
  global: GlobalTick[];
  summary: {
    ticksInWindow: number;
    totalRunsInWindow: number;
    okRunsInWindow: number;
    errorRunsInWindow: number;
  };
}

type Body = { ok: true; data: Data } | { ok: false; error: string; hint?: string };

export default function ReleaseOpsAutonomyPage() {
  const [resp, setResp] = useState<Body | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/autonomy-history", { credentials: "include" })
      .then((r) => r.json())
      .then((j: Body) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`AGI cockpit · releaseops autonomy${data ? ` · ${data.summary.ticksInWindow} ticks` : ""}`}
        title={<>The engines <span className="text-zinc-500">run themselves.</span></>}
        description="Every hour, a Vercel cron triggers the autonomous tick. The orchestrator scans active releases for advisor runs, open incidents for triage + remediation, and the org for policy proposals. Subjects with a recent run are skipped. This page shows what the AGI has been doing without you."
        helps="Use this page to confirm the AGI is actually running. Each row is a tick — totals + per-engine error/skip counts. Read across to see which engines made progress in the last window."
        connectFirst="Wired automatically via vercel.json cron entry. The CRON_SECRET env var must be set in the deploy environment."
        engineers={["Platform team", "AI Operations"]}
        requiresApproval="Tick is read-only — engines emit recommendations + proposals, never auto-execute. Operator-in-the-loop preserved."
        actions={[
          { label: "Open AGI cockpit",  href: "/dashboard/agi-cockpit" },
          { label: "Open learning loop", href: "/dashboard/learning-loop" },
        ]}
        safetyNote="Best-effort persistence · errors during persistence never block the tick · per-engine per-subject independent error handling"
      />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={ClockIcon} label="Ticks (50 most recent)" value={String(data.summary.ticksInWindow)} tone="zinc" />
          <Stat icon={CpuChipIcon} label="Runs in window" value={String(data.summary.totalRunsInWindow)} tone="zinc" />
          <Stat icon={CheckCircleIcon} label="OK runs" value={String(data.summary.okRunsInWindow)} tone={data.summary.okRunsInWindow > 0 ? "emerald" : "zinc"} />
          <Stat icon={XCircleIcon} label="Error runs" value={String(data.summary.errorRunsInWindow)} tone={data.summary.errorRunsInWindow > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">Loading autonomy history…</div>}
      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">Sign in required.</div>
      )}

      {data && data.org.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8 text-center">
          <p className="text-[14px] font-semibold text-violet-100 mb-2">No autonomy ticks yet.</p>
          <p className="text-[12.5px] text-zinc-400">
            The cron runs hourly. If you just deployed this phase, wait for the next top-of-the-hour tick — or trigger manually with
            <code className="ml-1 font-mono text-zinc-200">GET /api/cron/releaseops-autonomous-tick?secret=$CRON_SECRET</code>
          </p>
        </div>
      )}

      {data && data.org.length > 0 && (
        <>
          <h2 className="text-[13px] font-semibold text-white mb-3">Your org's recent ticks</h2>
          <div className="space-y-2 mb-8">
            {data.org.map((tick) => <TickCard key={tick.id} tick={tick} />)}
          </div>

          {data.global.length > 0 && (
            <>
              <h2 className="text-[13px] font-semibold text-white mb-3">Global tick overview</h2>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <table className="w-full text-[11.5px] font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">When</th>
                      <th className="text-right px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Total</th>
                      <th className="text-right px-3 py-2 text-emerald-400 uppercase tracking-[0.18em] text-[10px]">OK</th>
                      <th className="text-right px-3 py-2 text-amber-400 uppercase tracking-[0.18em] text-[10px]">Skip</th>
                      <th className="text-right px-3 py-2 text-rose-400 uppercase tracking-[0.18em] text-[10px]">Err</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.global.map((g) => (
                      <tr key={g.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-3 py-1.5 text-zinc-300">{new Date(g.generatedAtIso).toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-200">{g.totalRuns}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-300">{g.okRuns}</td>
                        <td className="px-3 py-1.5 text-right text-amber-300">{g.skippedRuns}</td>
                        <td className="px-3 py-1.5 text-right text-rose-300">{g.errorRuns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TickCard({ tick }: { tick: OrgTick }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11px] font-mono text-zinc-300">{new Date(tick.generatedAtIso).toLocaleString()}</span>
        <span className="text-[10px] font-mono text-zinc-500">total {tick.totalRuns}</span>
        <span className="text-[10px] font-mono text-emerald-300">ok {tick.okRuns}</span>
        <span className="text-[10px] font-mono text-amber-300">skip {tick.skippedRuns}</span>
        <span className="text-[10px] font-mono text-rose-300">err {tick.errorRuns}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <EngineBreakdown label="Advisor" runs={tick.report.advisorRuns} />
        <EngineBreakdown label="Triage" runs={tick.report.triageRuns} />
        <EngineBreakdown label="Remediation" runs={tick.report.remediationRuns} />
        <EngineBreakdown label="Policy" runs={tick.report.policyProposalRun ? [{ outcome: tick.report.policyProposalRun.outcome }] : []} />
      </div>
    </div>
  );
}

function EngineBreakdown({ label, runs }: { label: string; runs: { outcome: string }[] }) {
  const ok = runs.filter((r) => r.outcome === "ok").length;
  const skip = runs.filter((r) => r.outcome === "skipped").length;
  const err = runs.filter((r) => r.outcome === "error").length;
  return (
    <div className="rounded border border-zinc-700/30 bg-black/20 p-2">
      <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">{label}</p>
      <p className="text-[11px] font-mono">
        <span className="text-emerald-300">{ok}</span>
        <span className="text-zinc-500"> · </span>
        <span className="text-amber-300">{skip}</span>
        <span className="text-zinc-500"> · </span>
        <span className="text-rose-300">{err}</span>
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ClockIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
