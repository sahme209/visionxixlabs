/**
 * WorkflowsView — Phase 406-desktop.
 *
 * Single source of truth for all pipeline runs. Lists every status
 * with a tab filter on top, paginated via the v1 list endpoint.
 */

import { useEffect, useState } from "react";
import { desktopClient } from "../lib/desktopClient";
import { Badge, Card, DataSourceBanner, LoadingState, ViewShell } from "../components/Primitives";

interface Run {
  id: string;
  pipelineId: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  stageCount: number;
}

type StatusFilter = "all" | "running" | "succeeded" | "failed" | "awaiting_approval";

export function WorkflowsView() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [runs, setRuns] = useState<ReadonlyArray<Run> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!desktopClient.hasAuth()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    desktopClient.v1ListPipelineRuns({
      limit: 25,
      status: filter === "all" ? undefined : filter,
    }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const d = res.data as { runs: ReadonlyArray<Run> };
        setRuns(d.runs);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <ViewShell>
      <DataSourceBanner
        mode={!desktopClient.hasAuth() ? "preview" : runs && runs.length > 0 ? "live" : "authenticated_no_data"}
        surfaceName="workflows + pipeline runs"
        webPath="/dashboard/workflows"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">automation · workflows</p>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline runs</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Every workflow execution across the workspace. Filter by status; click into a run on the
          Orchestration view for the full stage timeline.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {(["all", "running", "succeeded", "failed", "awaiting_approval"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors ${
              filter === s
                ? "bg-violet-500/[0.10] border border-violet-500/30 text-violet-200"
                : "border border-axiom-border text-zinc-400 hover:text-white hover:border-white/[0.18]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Loading workflow runs…" />}

      {!loading && error && (
        <Card className="p-4">
          <p className="text-[12px] text-red-300">
            ✗ Couldn&apos;t load workflows: <span className="font-mono">{error}</span>
          </p>
        </Card>
      )}

      {!loading && runs && runs.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-zinc-300">No workflow runs match this filter.</p>
        </Card>
      )}

      {!loading && runs && runs.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-900/40 text-zinc-500">
              <tr>
                <th className="text-left font-mono uppercase tracking-wider px-4 py-2">run id</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">pipeline</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">status</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">stages</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">started</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">completed</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-axiom-border hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2 text-zinc-200">{r.id.slice(0, 18)}…</td>
                  <td className="px-3 py-2 text-zinc-300">{r.pipelineId}</td>
                  <td className="px-3 py-2">
                    <Badge tone={
                      r.status === "succeeded" ? "success" :
                      r.status === "failed"    ? "danger" :
                      r.status === "running"   ? "cyan" :
                                                 "warning"
                    }>{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{r.stageCount}</td>
                  <td className="px-3 py-2 text-zinc-500">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-zinc-500">
                    {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
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
