import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface EventView {
  id: string;
  kind: string;
  subjectKind: string;
  subjectId: string;
  outcome: string;
  summary: string;
  actorUserId: string | null;
  correlationId: string | null;
  createdAtIso: string;
}

interface ListData {
  generatedAt: string;
  events: EventView[];
  summary: { total: number; byOutcome: Record<string, number>; byKind: Record<string, number> };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const OUTCOME_CLASS: Record<string, string> = {
  ok:       "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  skipped:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function ReleaseAuditView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState("");

  function loadList(filterKind: string) {
    setLoading(true);
    setNetworkError(null);
    const url = filterKind
      ? `/api/dashboard/audit-event-list?kind=${encodeURIComponent(filterKind)}`
      : "/api/dashboard/audit-event-list";
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(""); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Release audit log</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Append-only record of every ReleaseOps state change. Best-effort writes from each responder.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="OK" value={String(data.summary.byOutcome.ok ?? 0)} tone="emerald" />
          <Stat label="Rejected" value={String(data.summary.byOutcome.rejected ?? 0)} tone={(data.summary.byOutcome.rejected ?? 0) > 0 ? "amber" : "zinc"} />
          <Stat label="Error" value={String(data.summary.byOutcome.error ?? 0)} tone={(data.summary.byOutcome.error ?? 0) > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {data && Object.keys(data.summary.byKind).length > 0 && (
        <div className="glass-card p-3 flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="text-zinc-500 uppercase tracking-[0.18em]">filter</span>
          <button
            type="button"
            onClick={() => { setKindFilter(""); loadList(""); }}
            className={`px-2 py-1 rounded border ${kindFilter === "" ? "border-violet-500/40 bg-violet-500/[0.16] text-violet-200" : "border-zinc-700/40 bg-zinc-800/40 text-zinc-300 hover:border-violet-500/40"} transition-colors`}
          >
            all ({data.summary.total})
          </button>
          {Object.entries(data.summary.byKind).map(([k, count]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKindFilter(k); loadList(k); }}
              className={`px-2 py-1 rounded border ${kindFilter === k ? "border-violet-500/40 bg-violet-500/[0.16] text-violet-200" : "border-zinc-700/40 bg-zinc-800/40 text-zinc-300 hover:border-violet-500/40"} transition-colors`}
            >
              {k} ({count})
            </button>
          ))}
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading audit events…</div>}

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
        data.events.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            {kindFilter ? `No "${kindFilter}" events yet.` : "No audit events yet. State-changing actions will append here."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.events.map((e) => (
              <div key={e.id} className="glass-card p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[e.outcome] ?? OUTCOME_CLASS.unknown}`}>
                    {e.outcome}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">{e.kind}</span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {e.subjectKind}:{e.subjectId}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                    {new Date(e.createdAtIso).toLocaleString()}
                  </span>
                </div>
                <p className="text-[12.5px] text-zinc-200">{e.summary}</p>
                {(e.actorUserId || e.correlationId) && (
                  <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-zinc-500">
                    {e.actorUserId && <span>actor: {e.actorUserId}</span>}
                    {e.correlationId && <span>req: {e.correlationId}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
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
