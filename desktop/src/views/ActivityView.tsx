/**
 * ActivityView — a single operational feed that merges three honest
 * signals the operator usually has to context-switch between:
 *
 *   1. Live pipeline runs (last 25, any status) from the v1 list endpoint.
 *   2. Local vote history (last 25 cast from this desktop, persisted).
 *   3. Offline queue depth + last error (so a Wi-Fi blip is visible).
 *
 * The point isn't to replace the Approvals / Workflows / Audit views —
 * it's an at-a-glance "what's happening with my work" panel.
 */

import { useEffect, useState } from "react";
import { desktopClient } from "../lib/desktopClient";
import { Badge, Card, DataSourceBanner, LoadingState, ViewShell } from "../components/Primitives";
import { useVoteHistory, type VoteRecord } from "../lib/voteHistory";
import { useVoteQueue, type QueuedVote } from "../lib/voteQueue";
import { usePendingApprovals } from "../lib/approvalsStore";

interface RunRow {
  id: string;
  pipelineId: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  errorSummary: string | null;
  stageCount: number;
}

export function ActivityView() {
  const [runs, setRuns] = useState<ReadonlyArray<RunRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const votes = useVoteHistory();
  const queue = useVoteQueue();
  const pending = usePendingApprovals();

  useEffect(() => {
    if (!desktopClient.hasAuth()) { setLoading(false); return; }
    let cancelled = false;
    const tick = async () => {
      const res = await desktopClient.v1ListPipelineRuns({ limit: 25 });
      if (cancelled) return;
      if (res.ok) {
        setRuns(res.data.runs as ReadonlyArray<RunRow>);
        setError(null);
        setLastFetchedAt(new Date());
      } else {
        setError(res.error);
      }
      setLoading(false);
    };
    void tick();
    const id = setInterval(tick, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <ViewShell>
      <DataSourceBanner
        mode={!desktopClient.hasAuth() ? "preview" : runs && runs.length > 0 ? "live" : "authenticated_no_data"}
        surfaceName="recent activity"
        webPath="/dashboard/workforce/pipelines"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">operations · activity</p>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          A single feed merging recent pipeline runs, your local vote history, and the
          offline-retry queue. Refreshes every 15 seconds.
        </p>
      </div>

      <DiagnosticsStrip
        lastFetchedAt={lastFetchedAt}
        error={error}
        pendingCount={pending.count}
        queueDepth={queue.length}
        voteHistoryCount={votes.length}
      />

      {loading && <LoadingState label="Loading activity feed…" />}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentRunsPanel runs={runs} />
          <RecentVotesPanel votes={votes} />
        </div>
      )}

      {queue.length > 0 && <QueueRetryPanel queue={queue} />}
    </ViewShell>
  );
}

function DiagnosticsStrip({
  lastFetchedAt,
  error,
  pendingCount,
  queueDepth,
  voteHistoryCount,
}: {
  lastFetchedAt: Date | null;
  error: string | null;
  pendingCount: number;
  queueDepth: number;
  voteHistoryCount: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Pending approvals"     value={String(pendingCount)} tone={pendingCount > 0 ? "warning" : "neutral"} />
      <Stat label="Queued retries"        value={String(queueDepth)}   tone={queueDepth > 0 ? "warning" : "neutral"} />
      <Stat label="Recent votes (local)"  value={String(voteHistoryCount)} tone="neutral" />
      <Stat
        label="Last poll"
        value={lastFetchedAt ? relativeTime(lastFetchedAt) : "—"}
        tone={error ? "error" : "neutral"}
        sub={error ?? undefined}
      />
    </div>
  );
}

function Stat({
  label, value, tone, sub,
}: { label: string; value: string; tone: "neutral" | "warning" | "error"; sub?: string }) {
  const colorClass =
    tone === "warning" ? "border-white/30 bg-white/[0.06] text-zinc-200" :
    tone === "error"   ? "border-red-500/30 bg-red-500/[0.06] text-red-200" :
                         "border-axiom-border bg-white/[0.02] text-zinc-300";
  return (
    <div className={`rounded-lg border ${colorClass} px-3 py-2`}>
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="text-sm font-mono mt-0.5">{value}</div>
      {sub && <div className="text-[10px] font-mono opacity-60 truncate mt-0.5" title={sub}>{sub}</div>}
    </div>
  );
}

function RecentRunsPanel({ runs }: { runs: ReadonlyArray<RunRow> | null }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-axiom-border flex items-center justify-between">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-300">Pipeline runs · last 25</p>
        <span className="text-[10px] font-mono text-zinc-500">{runs?.length ?? 0} rows</span>
      </div>
      {(!runs || runs.length === 0) ? (
        <p className="p-4 text-[12px] text-zinc-500">No recent runs.</p>
      ) : (
        <ul className="divide-y divide-axiom-border">
          {runs.slice(0, 12).map((r) => (
            <li key={r.id} className="px-4 py-2 flex items-center gap-3">
              <RunStatusDot status={r.status} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono text-zinc-200 truncate" title={r.id}>
                  {r.pipelineId} · {r.id.slice(0, 12)}…
                </div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  {new Date(r.startedAt).toLocaleString()} · {r.stageCount} stages
                </div>
              </div>
              <RunStatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentVotesPanel({ votes }: { votes: ReadonlyArray<VoteRecord> }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-axiom-border flex items-center justify-between">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-300">Your recent votes</p>
        <span className="text-[10px] font-mono text-zinc-500">{votes.length}/25</span>
      </div>
      {votes.length === 0 ? (
        <p className="p-4 text-[12px] text-zinc-500">No votes cast from this desktop yet.</p>
      ) : (
        <ul className="divide-y divide-axiom-border">
          {votes.slice(0, 12).map((v) => (
            <li key={`${v.runId}:${v.castAt}`} className="px-4 py-2 flex items-center gap-3">
              <span className={`w-1.5 h-1.5 rounded-full ${v.decision === "approved" ? "bg-emerald-400" : "bg-red-400"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono text-zinc-200 truncate" title={v.runId}>
                  {v.runId.slice(0, 20)}…
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {new Date(v.castAt).toLocaleString()} · {v.source}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  v.decision === "approved" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                }`}>{v.decision}</span>
                <div className="text-[10px] font-mono text-zinc-600 mt-0.5">
                  {v.approvedCount}/{v.requiredApprovers}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QueueRetryPanel({ queue }: { queue: ReadonlyArray<QueuedVote> }) {
  return (
    <Card className="p-0 overflow-hidden border-white/30">
      <div className="px-4 py-2.5 border-b border-white/30 bg-white/[0.05] flex items-center justify-between">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-200">Offline queue · awaiting retry</p>
        <span className="text-[10px] font-mono text-zinc-300">{queue.length}</span>
      </div>
      <ul className="divide-y divide-axiom-border">
        {queue.map((q) => (
          <li key={q.localId} className="px-4 py-2 flex items-center gap-3">
            <span className={`w-1.5 h-1.5 rounded-full ${q.decision === "approved" ? "bg-emerald-400" : "bg-red-400"}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono text-zinc-200 truncate" title={q.runId}>
                {q.decision} · {q.runId.slice(0, 18)}…
              </div>
              <div className="text-[10px] font-mono text-zinc-500 truncate" title={q.lastError ?? undefined}>
                Attempts: {q.attempts}{q.lastError ? ` · ${q.lastError}` : ""}
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-300">
              enqueued {relativeTime(new Date(q.enqueuedAt))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RunStatusDot({ status }: { status: string }) {
  const cls =
    status === "succeeded"         ? "bg-emerald-400" :
    status === "failed"            ? "bg-red-400" :
    status === "running"           ? "bg-cyan-400 animate-pulse" :
    status === "awaiting_approval" ? "bg-zinc-400 animate-pulse" :
                                     "bg-zinc-500";
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />;
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === "awaiting_approval") return <Badge tone="warning">awaiting</Badge>;
  if (status === "succeeded")         return <Badge tone="success">succeeded</Badge>;
  if (status === "failed")            return <Badge tone="danger">failed</Badge>;
  if (status === "running")           return <Badge tone="cyan">running</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

function relativeTime(d: Date): string {
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 5)   return "just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  const m = Math.round(diffSec / 60);
  if (m < 60)        return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24)        return `${h}h ago`;
  return d.toLocaleDateString();
}
