/**
 * ApprovalsView — Phase 406-desktop.
 *
 * Lists pipeline runs waiting on human review. Fetched live from
 * /api/v1/pipelines/runs?status=awaiting_approval with 5s polling.
 *
 * Phase 405 living-docs rule applies: when the platform adds
 * /api/v1/approvals/decide, wire the per-row approve/reject buttons.
 */

import { useEffect, useState } from "react";
import { desktopClient } from "../lib/desktopClient";
import { Badge, Card, DataSourceBanner, LoadingState, ViewShell } from "../components/Primitives";

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

const POLL_MS = 5_000;

export function ApprovalsView() {
  const [runs, setRuns] = useState<ReadonlyArray<PendingRun> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!desktopClient.hasAuth()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchPending = async () => {
      const res = await desktopClient.v1ListPipelineRuns({ limit: 25, status: "awaiting_approval" });
      if (cancelled) return;
      if (res.ok) {
        const d = res.data as { runs: ReadonlyArray<PendingRun> };
        setRuns(d.runs);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    };

    fetchPending();
    const interval = setInterval(fetchPending, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

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
          Pipeline runs that have completed a stage requiring two-person review. Approve from the
          web app — the desktop polls every 5 seconds for live updates.
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
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-axiom-border hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2 text-zinc-200">{r.id.slice(0, 18)}…</td>
                  <td className="px-3 py-2 text-zinc-300">{r.pipelineId}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.stageCount}</td>
                  <td className="px-3 py-2 text-zinc-500">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-zinc-400 truncate max-w-[160px]" title={r.triggeredBy}>{r.triggeredBy}</td>
                  <td className="px-3 py-2">
                    <Badge tone="warning">awaiting</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </ViewShell>
  );
}
