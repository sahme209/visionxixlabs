import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 464 — desktop sibling for /dashboard/change-tickets.
 * Cross-provider Jira/Linear/ServiceNow ticket inbox.
 */

type Status = "pending" | "in_progress" | "approved" | "implemented" | "rejected" | "cancelled" | "unknown";
type Provider = "jira" | "linear" | "servicenow" | "other" | "unknown";

interface Row {
  id: string;
  provider: Provider;
  externalKey: string;
  title: string;
  ticketType: string;
  status: Status;
  priority: string;
  assigneeUserId: string | null;
  labels: string[];
  webUrl: string | null;
  linkedPrCount: number;
  linkedReleaseCount: number;
  openedAtIso: string | null;
  closedAtIso: string | null;
  lastSyncedAtIso: string;
}

interface DigestData {
  generatedAt: string;
  tickets: Row[];
  summary: {
    total: number;
    byStatus: Record<Status, number>;
    byProvider: Record<Provider, number>;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  pending:     "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  approved:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  implemented: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  cancelled:   "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
  unknown:     "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

const PROVIDER_LABEL: Record<Provider, string> = {
  jira: "Jira", linear: "Linear", servicenow: "ServiceNow", other: "Other", unknown: "?",
};

export function ChangeTicketsView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/change-ticket-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Change tickets</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Jira · Linear · ServiceNow normalized to one closed-union.
          </p>
        </div>
      </div>

      <ProviderSyncControls onSynced={loadList} />

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading change tickets…</div>}

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
            <Stat label="Pending"     value={String(data.summary.byStatus.pending)} />
            <Stat label="In progress" value={String(data.summary.byStatus.in_progress)} tone={data.summary.byStatus.in_progress > 0 ? "amber" : "zinc"} />
            <Stat label="Approved"    value={String(data.summary.byStatus.approved)}    tone={data.summary.byStatus.approved > 0 ? "violet" : "zinc"} />
            <Stat label="Implemented" value={String(data.summary.byStatus.implemented)} tone={data.summary.byStatus.implemented > 0 ? "emerald" : "zinc"} />
          </div>

          {data.tickets.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No change tickets ingested yet.
            </div>
          ) : (
            <div className="space-y-2">
              {data.tickets.map((t) => (
                <div key={t.id} className="glass-card p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300 border border-zinc-600/40 shrink-0">
                        {PROVIDER_LABEL[t.provider]}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">{t.externalKey}</span>
                      <p className="text-[13px] font-semibold text-white truncate">{t.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[t.status]}`}>
                        {t.status.replace("_", " ")}
                      </span>
                      {t.linkedPrCount > 0 && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                          {t.linkedPrCount} PR
                        </span>
                      )}
                      {t.linkedReleaseCount > 0 && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                          {t.linkedReleaseCount} rel
                        </span>
                      )}
                    </div>
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

type SyncProvider = "linear" | "jira" | "servicenow";

type SyncOutcome =
  | { kind: "idle" }
  | { kind: "running"; which: SyncProvider }
  | { kind: "ok"; which: SyncProvider; fetched: number; upserted: number; skipped: number }
  | { kind: "error"; which: SyncProvider; message: string };

function ProviderSyncControls({ onSynced }: { onSynced: () => void }) {
  const [outcome, setOutcome] = useState<SyncOutcome>({ kind: "idle" });

  async function trigger(which: SyncProvider) {
    setOutcome({ kind: "running", which });
    try {
      const res = await fetch("/api/dashboard/change-ticket-sync", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: which }),
      });
      const json = await res.json();
      if (json.ok) {
        setOutcome({ kind: "ok", which, fetched: json.data.fetched, upserted: json.data.upserted, skipped: json.data.skipped });
        onSynced();
      } else {
        setOutcome({ kind: "error", which, message: json.hint ?? json.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", which, message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = outcome.kind === "running";
  return (
    <div className="glass-card p-3 flex items-center gap-2 flex-wrap text-[10px] font-mono">
      <span className="text-zinc-500 uppercase tracking-[0.18em]">Sync</span>
      {(["linear", "jira", "servicenow"] as const).map((p) => (
        <button
          key={p}
          type="button"
          disabled={busy}
          onClick={() => trigger(p)}
          className="px-2 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300 hover:border-violet-500/40 hover:text-violet-200 disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {outcome.kind === "running" && outcome.which === p
            ? "…"
            : p === "linear" ? "Linear" : p === "jira" ? "Jira" : "ServiceNow"}
        </button>
      ))}
      {outcome.kind === "ok" && (
        <span className="text-emerald-300">
          ✓ {outcome.fetched} fetched · {outcome.upserted} upserted
          {outcome.skipped > 0 && ` · ${outcome.skipped} skipped`}
        </span>
      )}
      {outcome.kind === "error" && (
        <span className="text-rose-300">✗ {outcome.which} · {outcome.message}</span>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "violet" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    violet:  "border-violet-500/20 text-violet-200",
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
