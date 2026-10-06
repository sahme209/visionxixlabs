import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 481 — desktop sibling for /dashboard/release-readiness.
 */

type Risk = "low" | "medium" | "high" | "critical" | "unknown";

interface Row {
  releaseId: string;
  applicationId: string;
  releaseTag: string | null;
  status: string;
  hasSnapshot: boolean;
  overallScore: number | null;
  riskLevel: Risk | null;
  evaluatedAtIso: string | null;
  blockerCount: number;
  topBlockerMessage: string | null;
}

interface DigestData {
  generatedAt: string;
  releases: Row[];
  summary: {
    total: number;
    evaluated: number;
    byRisk: Record<Risk, number>;
    averageScore: number | null;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const RISK_CLASS: Record<Risk, string> = {
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium:   "bg-white/15 text-zinc-300 border-white/25",
  high:     "bg-orange-500/15 text-orange-300 border-orange-500/25",
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

export function ReleaseReadinessView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/readiness-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Release readiness</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Latest 8-dimension snapshot per release · audit trail in ReleaseReadinessSnapshot.
        </p>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading readiness snapshots…</div>}

      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-white/30">
          <p className="text-sm font-semibold text-zinc-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-zinc-300 border border-white/20">Sign in required.</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Avg score"      value={data.summary.averageScore === null ? "—" : `${data.summary.averageScore}/100`} tone={(data.summary.averageScore ?? 0) >= 80 ? "emerald" : (data.summary.averageScore ?? 0) >= 60 ? "amber" : "rose"} />
            <Stat label="Low risk"       value={String(data.summary.byRisk.low)} tone={data.summary.byRisk.low > 0 ? "emerald" : "zinc"} />
            <Stat label="High + crit"    value={String(data.summary.byRisk.high + data.summary.byRisk.critical)} tone={(data.summary.byRisk.high + data.summary.byRisk.critical) > 0 ? "rose" : "zinc"} />
            <Stat label="Unevaluated"    value={String(data.summary.total - data.summary.evaluated)} />
          </div>

          {data.releases.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No releases tracked yet.
            </div>
          ) : (
            <div className="space-y-2">
              {data.releases.map((r) => (
                <div key={r.releaseId} className="glass-card p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white truncate">{r.releaseTag ?? "(untagged)"}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{r.applicationId}</span>
                      <span className="text-[10px] font-mono text-zinc-500">· {r.status}</span>
                    </div>
                    {r.hasSnapshot && r.riskLevel ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${RISK_CLASS[r.riskLevel]}`}>
                          {r.riskLevel}
                        </span>
                        <span className="text-[12px] font-mono text-white">{r.overallScore}/100</span>
                        {r.blockerCount > 0 && (
                          <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                            {r.blockerCount} blocker{r.blockerCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">no snapshot yet</span>
                    )}
                  </div>
                  {r.topBlockerMessage && (
                    <p className="text-[11px] text-zinc-400 italic">→ {r.topBlockerMessage}</p>
                  )}
                  {r.evaluatedAtIso && (
                    <p className="text-[10px] font-mono text-zinc-500 mt-1">
                      Evaluated {new Date(r.evaluatedAtIso).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-white/20 text-zinc-200",
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
