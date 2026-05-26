import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 462 — desktop sibling for /dashboard/release-freeze.
 *
 * Three-bucket scope-freeze board. Late-merge PRs live on the
 * per-release branch-validation detail view.
 */

type Status = "not_yet_finalized" | "frozen" | "deploy_window_started";

interface Row {
  releaseId: string;
  applicationId: string;
  releaseTag: string | null;
  status: Status;
  hoursSinceScopeFinalized: number | null;
  scopeFinalizedAtIso: string | null;
  scopeFinalizedByUserId: string | null;
  plannedWindowStartIso: string | null;
  plannedWindowEndIso: string | null;
  actualDeployStartIso: string | null;
  actualDeployEndIso: string | null;
  summary: string;
}

interface DigestData {
  generatedAt: string;
  releases: Row[];
  summary: { total: number; byStatus: Record<Status, number> };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  not_yet_finalized:     "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
  frozen:                "bg-violet-500/15 text-violet-300 border-violet-500/25",
  deploy_window_started: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

const STATUS_LABEL: Record<Status, string> = {
  not_yet_finalized:     "Draft",
  frozen:                "Frozen",
  deploy_window_started: "Deploying",
};

export function ReleaseFreezeView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/release-freeze-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Release freeze</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Draft · frozen · deploying. Three buckets per release.
        </p>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading freeze board…</div>}

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

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Draft"     value={String(data.summary.byStatus.not_yet_finalized)} />
            <Stat label="Frozen"    value={String(data.summary.byStatus.frozen)}             tone={data.summary.byStatus.frozen > 0 ? "violet" : "zinc"} />
            <Stat label="Deploying" value={String(data.summary.byStatus.deploy_window_started)} tone={data.summary.byStatus.deploy_window_started > 0 ? "emerald" : "zinc"} />
          </div>

          {data.releases.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No releases on file.
            </div>
          ) : (
            <div className="space-y-2">
              {data.releases.map((r) => (
                <div key={r.releaseId} className="glass-card p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">{r.releaseTag ?? "(untagged)"}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{r.applicationId}</span>
                    </div>
                    {r.hoursSinceScopeFinalized !== null && (
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 shrink-0">
                        {r.hoursSinceScopeFinalized}h
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-400 mb-1.5">{r.summary}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 flex-wrap">
                    {r.scopeFinalizedByUserId && <span>frozen by {r.scopeFinalizedByUserId}</span>}
                    {r.actualDeployStartIso && (
                      <span>· deploy started {new Date(r.actualDeployStartIso).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "violet" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    violet:  "border-violet-500/20 text-violet-200",
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
