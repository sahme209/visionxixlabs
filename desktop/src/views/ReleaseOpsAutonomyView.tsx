import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

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

interface Data {
  generatedAt: string;
  org: OrgTick[];
  summary: { ticksInWindow: number; totalRunsInWindow: number; okRunsInWindow: number; errorRunsInWindow: number };
}

type Body = { ok: true; data: Data } | { ok: false; error: string; hint?: string };

export function ReleaseOpsAutonomyView() {
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
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">ReleaseOps autonomy</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Hourly cron · advisor + triage + remediation + policy-proposal runs without operator clicks.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Ticks" value={String(data.summary.ticksInWindow)} />
          <Stat label="Runs" value={String(data.summary.totalRunsInWindow)} />
          <Stat label="OK" value={String(data.summary.okRunsInWindow)} tone={data.summary.okRunsInWindow > 0 ? "emerald" : "zinc"} />
          <Stat label="Errors" value={String(data.summary.errorRunsInWindow)} tone={data.summary.errorRunsInWindow > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading autonomy history…</div>}
      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">Sign in required.</div>
      )}

      {data && data.org.length === 0 && (
        <div className="glass-card p-8 text-center border border-violet-500/20">
          <p className="text-sm font-semibold text-violet-100 mb-1">No autonomy ticks yet.</p>
          <p className="text-xs text-zinc-400">
            Cron runs hourly. Wait for the next top-of-hour tick or trigger manually with
            <code className="ml-1 font-mono text-zinc-200">/api/cron/releaseops-autonomous-tick?secret=$CRON_SECRET</code>
          </p>
        </div>
      )}

      {data && data.org.length > 0 && (
        <div className="space-y-2">
          {data.org.map((tick) => <TickCard key={tick.id} tick={tick} />)}
        </div>
      )}
    </ViewShell>
  );
}

function TickCard({ tick }: { tick: OrgTick }) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11px] font-mono text-zinc-300">{new Date(tick.generatedAtIso).toLocaleString()}</span>
        <span className="text-[10px] font-mono text-zinc-500">total {tick.totalRuns}</span>
        <span className="text-[10px] font-mono text-emerald-300">ok {tick.okRuns}</span>
        <span className="text-[10px] font-mono text-amber-300">skip {tick.skippedRuns}</span>
        <span className="text-[10px] font-mono text-rose-300">err {tick.errorRuns}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Engine label="Advisor" runs={tick.report.advisorRuns} />
        <Engine label="Triage" runs={tick.report.triageRuns} />
        <Engine label="Remediation" runs={tick.report.remediationRuns} />
        <Engine label="Policy" runs={tick.report.policyProposalRun ? [{ outcome: tick.report.policyProposalRun.outcome }] : []} />
      </div>
    </div>
  );
}

function Engine({ label, runs }: { label: string; runs: { outcome: string }[] }) {
  const ok = runs.filter((r) => r.outcome === "ok").length;
  const skip = runs.filter((r) => r.outcome === "skipped").length;
  const err = runs.filter((r) => r.outcome === "error").length;
  return (
    <div className="rounded border border-zinc-700/30 bg-zinc-900/40 p-2">
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

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-amber-500/20 text-amber-200",
    rose:    "border-rose-500/20 text-rose-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
