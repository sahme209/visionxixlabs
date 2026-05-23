/**
 * AuditView — Phase 406-desktop.
 *
 * Honest banner — there's no /api/v1/audit endpoint yet on the
 * platform (audit rows are queryable internally via Prisma, but not
 * via v1 API). Surfaces what we DO have: a synthesized audit summary
 * from the last 25 pipeline runs + a deep-link to the web /dashboard/audit.
 */

import { useEffect, useState } from "react";
import { desktopClient } from "../lib/desktopClient";
import { Card, DataSourceBanner, LoadingState, ViewShell } from "../components/Primitives";

interface Run {
  id: string;
  pipelineId: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

interface AuditRow {
  ts: string;
  actor: string;
  action: string;
  outcome: "success" | "failure";
  entity: string;
}

function synthesizeAudit(runs: ReadonlyArray<Run>): ReadonlyArray<AuditRow> {
  const out: AuditRow[] = [];
  for (const r of runs) {
    out.push({
      ts: r.startedAt,
      actor: r.triggeredBy,
      action: "pipeline.run_started",
      outcome: "success",
      entity: r.id.slice(0, 16),
    });
    if (r.completedAt) {
      out.push({
        ts: r.completedAt,
        actor: r.triggeredBy,
        action: r.status === "succeeded" ? "pipeline.run_completed" : "pipeline.run_failed",
        outcome: r.status === "succeeded" ? "success" : "failure",
        entity: r.id.slice(0, 16),
      });
    }
  }
  return out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

export function AuditView() {
  const [runs, setRuns] = useState<ReadonlyArray<Run> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!desktopClient.hasAuth()) { setLoading(false); return; }
    let cancelled = false;
    desktopClient.v1ListPipelineRuns({ limit: 25 }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const d = res.data as { runs: ReadonlyArray<Run> };
        setRuns(d.runs);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const audit = runs ? synthesizeAudit(runs) : [];
  const mode = !desktopClient.hasAuth()
    ? "preview"
    : audit.length > 0
    ? "live"
    : "authenticated_no_data";

  return (
    <ViewShell>
      <DataSourceBanner
        mode={mode}
        surfaceName="audit log"
        webPath="/dashboard/audit"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">automation · audit log</p>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Every closed-union audit action emitted across the workspace. Synthesized from the last
          25 pipeline runs in this iteration; the full audit table lives in the web app at{" "}
          <span className="font-mono text-zinc-400">/dashboard/audit</span>.
        </p>
      </div>

      {loading && <LoadingState label="Loading audit rows…" />}

      {!loading && audit.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-900/40 text-zinc-500">
              <tr>
                <th className="text-left font-mono uppercase tracking-wider px-4 py-2">timestamp</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">actor</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">action</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">outcome</th>
                <th className="text-left font-mono uppercase tracking-wider px-3 py-2">entity</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {audit.map((row, idx) => (
                <tr key={idx} className="border-t border-axiom-border hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2 text-zinc-500">{new Date(row.ts).toLocaleString()}</td>
                  <td className="px-3 py-2 text-zinc-300 truncate max-w-[160px]">{row.actor}</td>
                  <td className="px-3 py-2 text-zinc-200">{row.action}</td>
                  <td className="px-3 py-2">
                    <span className={row.outcome === "success" ? "text-emerald-300" : "text-red-300"}>
                      {row.outcome}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{row.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </ViewShell>
  );
}
