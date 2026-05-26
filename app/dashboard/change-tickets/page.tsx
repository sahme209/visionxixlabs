"use client";

/**
 * /dashboard/change-tickets — Phase 464.
 * Cross-provider change-ticket inbox: Jira, Linear, ServiceNow rolled
 * into one normalized status closed-union.
 */

import { useEffect, useState } from "react";
import {
  TicketIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

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

const PRIORITY_TONE: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  high:     "bg-amber-500/15 text-amber-300 border-amber-500/25",
  normal:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  low:      "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
  trivial:  "bg-zinc-700/40 text-zinc-500 border-zinc-700/40",
};

export default function ChangeTicketsPage() {
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
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · change tickets${data ? ` · ${data.summary.total} on file` : ""}`}
        title={<>Three trackers. <span className="text-zinc-500">One closed-union.</span></>}
        description="Jira, Linear, and ServiceNow tickets normalized into a single status taxonomy. Feeds readiness checks, change-compliance scoring, and evidence packs."
        helps="See which tickets are approved vs implemented vs still in flight, and which ones have linked PRs / releases."
        connectFirst="Connect a Jira, Linear, or ServiceNow integration on the Connectors tab."
        engineers={["Release Captain", "Compliance", "PM"]}
        requiresApproval="Ticket status changes belong on the source-of-truth side; we only mirror."
        actions={[
          { label: "Releases",     href: "/dashboard/releases" },
          { label: "Connectors",   href: "/dashboard/connectors" },
        ]}
        safetyNote="Per-org isolation · 6-status closed-union enforced application-side"
      />

      <div className="mb-6 flex items-start gap-3 flex-wrap">
        <ProviderSyncControls onSynced={loadList} />
        <PrTicketEnrichButton onEnriched={loadList} />
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading change tickets…
        </div>
      )}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
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
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={ClockIcon}        label="Pending"     value={String(data.summary.byStatus.pending)}     tone="zinc" />
            <Stat icon={ArrowPathIcon}    label="In progress" value={String(data.summary.byStatus.in_progress)} tone={data.summary.byStatus.in_progress > 0 ? "amber" : "zinc"} />
            <Stat icon={CheckBadgeIcon}   label="Approved"    value={String(data.summary.byStatus.approved)}    tone={data.summary.byStatus.approved > 0 ? "violet" : "zinc"} />
            <Stat icon={TicketIcon}       label="Implemented" value={String(data.summary.byStatus.implemented)} tone={data.summary.byStatus.implemented > 0 ? "emerald" : "zinc"} />
          </div>

          {data.tickets.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No change tickets ingested yet. Connect a tracker to populate this inbox.
            </div>
          ) : (
            <div className="space-y-2 mb-8">
              {data.tickets.map((t) => (
                <div key={t.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300 border border-zinc-600/40 shrink-0">
                        {PROVIDER_LABEL[t.provider]}
                      </span>
                      <a
                        href={t.webUrl ?? "#"}
                        target={t.webUrl ? "_blank" : undefined}
                        rel={t.webUrl ? "noreferrer" : undefined}
                        className={`text-[10px] font-mono shrink-0 ${t.webUrl ? "text-zinc-400 hover:text-violet-300" : "text-zinc-500"}`}
                      >
                        {t.externalKey}
                      </a>
                      <p className="text-[13px] font-semibold text-white truncate">{t.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[t.status]}`}>
                        {t.status.replace("_", " ")}
                      </span>
                      {t.priority !== "normal" && (
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${PRIORITY_TONE[t.priority] ?? PRIORITY_TONE.normal}`}>
                          {t.priority}
                        </span>
                      )}
                      {t.linkedPrCount > 0 && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                          {t.linkedPrCount} PR
                        </span>
                      )}
                      {t.linkedReleaseCount > 0 && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
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
    </div>
  );
}

type EnrichOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; prsScanned: number; ticketsUpdated: number; linksAdded: number; linksRemoved: number; unresolvedKeys: string[] }
  | { kind: "error"; message: string };

function PrTicketEnrichButton({ onEnriched }: { onEnriched: () => void }) {
  const [outcome, setOutcome] = useState<EnrichOutcome>({ kind: "idle" });

  async function trigger() {
    setOutcome({ kind: "running" });
    try {
      const res = await fetch("/api/dashboard/pr-ticket-enrich", { method: "POST", credentials: "include" });
      const json = await res.json();
      if (json.ok) {
        setOutcome({
          kind: "ok",
          prsScanned: json.data.prsScanned,
          ticketsUpdated: json.data.ticketsUpdated,
          linksAdded: json.data.linksAdded,
          linksRemoved: json.data.linksRemoved,
          unresolvedKeys: json.data.unresolvedKeys,
        });
        onEnriched();
      } else {
        setOutcome({ kind: "error", message: json.hint ?? json.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = outcome.kind === "running";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-2 flex-wrap text-[10px] font-mono">
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="px-2 py-1 rounded border border-violet-500/30 bg-violet-500/[0.06] text-violet-200 hover:bg-violet-500/[0.12] disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        {busy ? "scanning…" : "Refresh PR ↔ ticket links"}
      </button>
      {outcome.kind === "ok" && (
        <span className="text-emerald-300">
          ✓ {outcome.prsScanned} PRs · {outcome.ticketsUpdated} updated
          {outcome.linksAdded > 0 && ` · +${outcome.linksAdded}`}
          {outcome.linksRemoved > 0 && ` · -${outcome.linksRemoved}`}
          {outcome.unresolvedKeys.length > 0 && (
            <span className="text-amber-300 ml-1.5" title={outcome.unresolvedKeys.join(", ")}>
              · {outcome.unresolvedKeys.length} unresolved
            </span>
          )}
        </span>
      )}
      {outcome.kind === "error" && <span className="text-rose-300">✗ {outcome.message}</span>}
    </div>
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
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: which }),
      });
      const json = await res.json();
      if (json.ok) {
        setOutcome({
          kind: "ok", which,
          fetched: json.data.fetched, upserted: json.data.upserted, skipped: json.data.skipped,
        });
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-2 flex-wrap text-[10px] font-mono flex-1 min-w-[300px]">
      <span className="text-zinc-500 uppercase tracking-[0.18em]">Sync from</span>
      {(["linear", "jira", "servicenow"] as const).map((p) => (
        <button
          key={p}
          type="button"
          disabled={busy}
          onClick={() => trigger(p)}
          className="px-2 py-1 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-violet-500/40 hover:text-violet-200 disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {outcome.kind === "running" && outcome.which === p
            ? `${p}…`
            : p === "linear" ? "Linear" : p === "jira" ? "Jira" : "ServiceNow"}
        </button>
      ))}
      {outcome.kind === "ok" && (
        <span className="text-emerald-300">
          ✓ {outcome.which} · fetched {outcome.fetched} · upserted {outcome.upserted}
          {outcome.skipped > 0 && ` · skipped ${outcome.skipped}`}
        </span>
      )}
      {outcome.kind === "error" && (
        <span className="text-rose-300">✗ {outcome.which} · {outcome.message}</span>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof TicketIcon; label: string; value: string; tone: "violet" | "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
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
