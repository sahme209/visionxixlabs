/**
 * ApprovalsView — Phase 406-desktop + 406-decide.
 *
 * Lists pipeline runs waiting on human review. Fetched live from
 * /api/v1/pipelines/runs?status=awaiting_approval with 5s polling.
 *
 * Approve / Reject per-row records ONE vote against the platform's
 * two-person quorum (pipeline gates default to requiredApprovers=2).
 * The desktop alone never tips a gate to terminal — that's the
 * platform-wide safety guarantee. After a vote we refresh the list
 * immediately so the operator sees the new count, and the row stays
 * visible until a second distinct actor's vote tips the gate
 * (at which point /v1/pipelines/runs?status=awaiting_approval drops
 * it from the response).
 */

import { useEffect, useRef, useState } from "react";
import { desktopClient } from "../lib/desktopClient";
import { Badge, Card, DataSourceBanner, LoadingState, ViewShell } from "../components/Primitives";
import { openExternal, setTrayApprovalBadge } from "../lib/notifications";
import { clearTrayPendingSelection, useTrayPendingSelection } from "../lib/useTrayPendingSelection";
import { recordVote } from "../lib/voteHistory";

const WEB_BASE = "https://visionxixlabs.com";

interface PendingRun {
  id: string;
  pipelineId: string;
  status: string;
  triggeredBy: string;
  correlationId: string;
  startedAt: string;
  completedAt: string | null;
  errorSummary: string | null;
  stageCount: number;
}

interface RowFeedback {
  state: "deciding" | "voted" | "error";
  decision?: "approved" | "rejected";
  message?: string;
  approvedCount?: number;
  rejectedCount?: number;
  requiredApprovers?: number;
}

const POLL_MS = 5_000;

export function ApprovalsView() {
  const [runs, setRuns] = useState<ReadonlyArray<PendingRun> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, RowFeedback>>({});
  // The tray's "Pending approvals" submenu emits a run id when clicked;
  // we scroll that row into view and pulse it briefly so the operator
  // sees which one they just jumped to.
  const trayHighlightId = useTrayPendingSelection();
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const fetchPending = async () => {
    const res = await desktopClient.v1ListPipelineRuns({ limit: 25, status: "awaiting_approval" });
    if (res.ok) {
      const d = res.data as { runs: ReadonlyArray<PendingRun> };
      setRuns(d.runs);
      setError(null);
      // Push the count to the tray — the App-level ambient hook also
      // updates it, but firing here makes the view's 5s cadence visible
      // immediately instead of waiting for the next 15s ambient tick.
      void setTrayApprovalBadge(d.runs.length);
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!desktopClient.hasAuth()) {
      setLoading(false);
      return;
    }

    // Notification permission + new-arrival diff live in the App-level
    // useTrayApprovalsBadge hook so alerts fire on every view, not just
    // here. This view only handles the table.
    let cancelled = false;
    const tick = async () => { if (!cancelled) await fetchPending(); };

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // When the tray hands us a runId, scroll the matching row into view.
  // Clear the selection afterward so a subsequent click on the same id
  // (e.g. operator returns to Approvals after navigating away) re-triggers.
  useEffect(() => {
    if (!trayHighlightId || !runs) return;
    const row = rowRefs.current.get(trayHighlightId);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const t = setTimeout(() => clearTrayPendingSelection(), 4_000);
    return () => clearTimeout(t);
  }, [trayHighlightId, runs]);

  const decide = async (runId: string, decision: "approved" | "rejected") => {
    setFeedback((prev) => ({ ...prev, [runId]: { state: "deciding", decision } }));
    const res = await desktopClient.v1DecideApproval({ runId, decision });
    if (res.ok) {
      setFeedback((prev) => ({
        ...prev,
        [runId]: {
          state: "voted",
          decision,
          approvedCount: res.data.approvedCount,
          rejectedCount: res.data.rejectedCount,
          requiredApprovers: res.data.requiredApprovers,
          message: res.data.isTerminal
            ? `Gate ${res.data.snapshotStatus} — run advanced`
            : `Vote recorded — ${res.data.approvedCount}/${res.data.requiredApprovers} approved`,
        },
      }));
      void recordVote({
        runId,
        decision,
        castAt: new Date().toISOString(),
        isTerminal: res.data.isTerminal,
        snapshotStatus: res.data.snapshotStatus,
        approvedCount: res.data.approvedCount,
        rejectedCount: res.data.rejectedCount,
        requiredApprovers: res.data.requiredApprovers,
        source: "row",
      });
      // Refresh now so terminal rows drop and quorum counters update.
      await fetchPending();
    } else {
      setFeedback((prev) => ({
        ...prev,
        [runId]: { state: "error", decision, message: res.error },
      }));
    }
  };

  return (
    <ViewShell>
      <DataSourceBanner
        mode={!desktopClient.hasAuth() ? "preview" : runs && runs.length > 0 ? "live" : "authenticated_no_data"}
        surfaceName="approvals queue"
        webPath="/dashboard/approvals"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">automation · approvals</p>
        <h1 className="text-2xl font-bold tracking-tight">Awaiting human approval</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Pipeline runs paused at a two-person review gate. Approve or reject from this list to
          record your vote — a second distinct approver still has to vote before the gate tips.
        </p>
      </div>

      {loading && <LoadingState label="Loading approvals queue…" />}

      {!loading && error && (
        <Card className="p-4">
          <p className="text-[12px] text-red-300">
            ✗ Couldn&apos;t load approvals: <span className="font-mono">{error}</span>
          </p>
        </Card>
      )}

      {!loading && !error && runs && runs.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-zinc-300">No runs currently awaiting approval.</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            When a pipeline stage requires two-person review, it surfaces here.
          </p>
        </Card>
      )}

      {!loading && runs && runs.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-900/40 text-zinc-500">
              <tr>
                <th className="text-left font-mono uppercase tracking-wider px-4 py-2">run id</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">pipeline</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">stages</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">started</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">triggered by</th>
                <th className="text-right font-mono uppercase tracking-wider px-3 py-2">decide</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {runs.map((r) => {
                const fb = feedback[r.id];
                const isDeciding = fb?.state === "deciding";
                const isHighlighted = trayHighlightId === r.id;
                return (
                  <tr
                    key={r.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(r.id, el);
                      else rowRefs.current.delete(r.id);
                    }}
                    className={`border-t border-axiom-border align-top transition-colors ${
                      isHighlighted
                        ? "bg-violet-500/[0.08] ring-1 ring-violet-500/30"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-4 py-3 text-zinc-200">{r.id.slice(0, 18)}…</td>
                    <td className="px-3 py-3 text-zinc-300">{r.pipelineId}</td>
                    <td className="px-3 py-3 text-zinc-400">{r.stageCount}</td>
                    <td className="px-3 py-3 text-zinc-500">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-zinc-400 truncate max-w-[160px]" title={r.triggeredBy}>{r.triggeredBy}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {fb?.state === "voted" ? (
                          <span className="text-[10px] text-emerald-300 italic">{fb.message}</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isDeciding}
                              onClick={() => decide(r.id, "approved")}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isDeciding && fb?.decision === "approved" ? "voting…" : "approve"}
                            </button>
                            <button
                              type="button"
                              disabled={isDeciding}
                              onClick={() => decide(r.id, "rejected")}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isDeciding && fb?.decision === "rejected" ? "voting…" : "reject"}
                            </button>
                            <button
                              type="button"
                              title="Open in web dashboard"
                              onClick={() => void openExternal(`${WEB_BASE}/dashboard/workforce/pipelines/runs/${r.id}`)}
                              className="px-2 py-1 rounded-md text-[11px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.08] transition-colors"
                            >
                              ↗
                            </button>
                            <Badge tone="warning">awaiting</Badge>
                          </>
                        )}
                      </div>
                      {fb?.state === "error" && (
                        <p className="mt-1 text-right text-[10px] text-red-300 truncate max-w-[260px]" title={fb.message}>
                          ✗ {fb.message}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </ViewShell>
  );
}
