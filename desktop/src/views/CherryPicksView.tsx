import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 461 — desktop sibling for /dashboard/cherry-picks.
 *
 * Read-only inbox of cherry-pick exceptions. Approve/deny flows land
 * in a follow-on phase alongside their web counterparts.
 */

type Status = "requested" | "approved" | "denied" | "superseded" | "unknown";

interface Row {
  id: string;
  releaseId: string;
  releaseTag: string | null;
  applicationId: string | null;
  repositoryId: string;
  repositoryDisplayName: string | null;
  status: Status;
  rationale: string;
  approvedCount: number;
  excludedCount: number;
  hasFinalCommitValidation: boolean;
  requestedByUserId: string;
  requestedAtIso: string;
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionReason: string | null;
}

interface DigestData {
  generatedAt: string;
  exceptions: Row[];
  summary: { total: number; byStatus: Record<Status, number> };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  requested:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  approved:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  denied:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  superseded: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
  unknown:    "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

export function CherryPicksView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/cherry-pick-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Cherry-pick exceptions</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Out-of-train fixes with rationale + approver decision.
        </p>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading exceptions…</div>}

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
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Requested" value={String(data.summary.byStatus.requested)} tone={data.summary.byStatus.requested > 0 ? "amber" : "zinc"} />
            <Stat label="Approved"  value={String(data.summary.byStatus.approved)}  tone={data.summary.byStatus.approved > 0 ? "emerald" : "zinc"} />
            <Stat label="Denied"    value={String(data.summary.byStatus.denied)}    tone={data.summary.byStatus.denied > 0 ? "rose" : "zinc"} />
            <Stat label="Total"     value={String(data.summary.total)} />
          </div>

          {data.exceptions.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No cherry-pick exceptions on file.
            </div>
          ) : (
            <div className="space-y-2">
              {data.exceptions.map((e) => (
                <div key={e.id} className="glass-card p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[e.status]}`}>
                        {e.status}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">
                        {e.releaseTag ?? "(untagged)"} · {e.repositoryDisplayName ?? "(unknown repo)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {e.approvedCount} approved
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {e.excludedCount} excluded
                      </span>
                      {e.hasFinalCommitValidation && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          final ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-1.5 whitespace-pre-wrap">{e.rationale}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 flex-wrap">
                    <span>requested by {e.requestedByUserId} · {new Date(e.requestedAtIso).toLocaleString()}</span>
                    {e.decidedAtIso && (
                      <span>· decided by {e.decidedByUserId} · {new Date(e.decidedAtIso).toLocaleString()}</span>
                    )}
                  </div>
                  {e.decisionReason && (
                    <p className="text-[11px] text-zinc-400 mt-1.5 italic">"{e.decisionReason}"</p>
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
