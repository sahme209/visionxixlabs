/**
 * Orchestration view — live orchestrations + approvals + active locks
 * from /api/orchestration. Provides one-click approve/reject for
 * pending approvals.
 */

import { useEffect, useState } from "react";
import { desktopClient, type OrchestrationListLite } from "../lib/desktopClient";
import { Card, SectionHeader, ViewShell, LoadingState, EmptyState, Badge, Kpi, statusToneFor, riskToneFor } from "../components/Primitives";

interface V1PipelineRun {
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

export function OrchestrationView() {
  const [data, setData] = useState<OrchestrationListLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionMsg, setDecisionMsg] = useState<string | null>(null);
  // v1 pipeline runs from Phase 396 — live data when an API key is paired.
  const [v1Runs, setV1Runs] = useState<ReadonlyArray<V1PipelineRun> | null>(null);
  const [v1RunsError, setV1RunsError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    desktopClient.orchestration().then((res) => {
      if (res.ok) setData(res.data);
      else setError(res.error);
      setLoading(false);
    });
    if (desktopClient.hasAuth()) {
      desktopClient.v1ListPipelineRuns({ limit: 10 }).then((res) => {
        if (res.ok) {
          const d = res.data as { runs: ReadonlyArray<V1PipelineRun> };
          setV1Runs(d.runs);
          setV1RunsError(null);
        } else {
          setV1Runs(null);
          setV1RunsError(res.error);
        }
      });
    } else {
      setV1Runs(null);
      setV1RunsError(null);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    setDecisionMsg(null);
    const res = await desktopClient.decideApproval(id, decision);
    setBusyId(null);
    setDecisionMsg(res.ok ? `Approval ${id} ${decision}.` : `Failed: ${res.error}`);
    refresh();
  };

  if (loading && !data) return <ViewShell><LoadingState label="Loading orchestrations…" /></ViewShell>;
  if (error && !data) {
    return (
      <ViewShell>
        <EmptyState
          Icon={CtrlIcon}
          title="No orchestrations available"
          detail={error}
          action={<a href="https://visionxixlabs.com/dashboard/orchestration" target="_blank" rel="noreferrer" className="btn-primary">Open in web</a>}
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell>
      <SectionHeader
        kicker="// orchestration"
        title="The operations control tower."
        subtitle={`Every remediation passes through simulated → policy → approval → preflight → execution-ready → verification → audit.`}
      />

      {/* Recent pipeline runs — Phase 396 v1 surface. Only renders when
          an API key is paired AND the list endpoint returns rows. */}
      {v1Runs && v1Runs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em]">// recent pipeline runs · v1</h2>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-zinc-900/40 text-zinc-500">
                <tr>
                  <th className="text-left font-mono uppercase tracking-wider px-4 py-2">run id</th>
                  <th className="text-left font-mono uppercase tracking-wider px-3 py-2">pipeline</th>
                  <th className="text-left font-mono uppercase tracking-wider px-3 py-2">status</th>
                  <th className="text-left font-mono uppercase tracking-wider px-3 py-2">stages</th>
                  <th className="text-left font-mono uppercase tracking-wider px-3 py-2">started</th>
                  <th className="text-left font-mono uppercase tracking-wider px-3 py-2">triggered by</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {v1Runs.map((r) => (
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
                    <td className="px-3 py-2 text-zinc-400 truncate max-w-[160px]" title={r.triggeredBy}>{r.triggeredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
      {v1RunsError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-[11px] text-amber-200">
          v1 pipeline runs unavailable: <span className="font-mono">{v1RunsError}</span>
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-4 gap-3">
            <Kpi label="Active"               value={data.summary.total}               tone="violet" />
            <Kpi label="Approval requested"   value={data.summary.approvalRequested}   tone="amber" />
            <Kpi label="Blocked"              value={data.summary.blocked}             tone="rose" />
            <Kpi label="Desktop review ready" value={data.summary.desktopReviewReady}  tone="cyan" />
          </section>

          {/* Pending approvals — actionable. */}
          <section>
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">// pending approvals</h2>
            {decisionMsg && (
              <div className="mb-3 text-[12px] text-emerald-300 font-mono">{decisionMsg}</div>
            )}
            <Card className="p-2">
              {data.approvals.filter((a) => a.status === "pending").length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-zinc-500">No pending approvals.</p>
              ) : (
                <ul className="divide-y divide-axiom-border">
                  {data.approvals.filter((a) => a.status === "pending").slice(0, 8).map((a) => (
                    <li key={a.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge tone={riskToneFor(a.riskLevel)}>{a.riskLevel}</Badge>
                            <Badge tone="warning">pending</Badge>
                            <span className="text-[10px] font-mono text-zinc-500">{a.provider}</span>
                            <span className="text-[10px] font-mono text-zinc-600">·</span>
                            <span className="text-[10px] font-mono text-zinc-500">{a.approverRole}</span>
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{a.changeSummary}</p>
                          <p className="text-[10px] font-mono text-zinc-600 mt-0.5">expires {new Date(a.expiresAt).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            disabled={busyId === a.id}
                            onClick={() => handleDecision(a.id, "rejected")}
                            className="px-3 py-1.5 rounded-md border border-rose-500/30 text-rose-300 text-[11px] font-semibold hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            disabled={busyId === a.id}
                            onClick={() => handleDecision(a.id, "approved")}
                            className="px-3 py-1.5 rounded-md border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {/* Active orchestrations */}
          <section>
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">// active orchestrations</h2>
            <Card className="p-2">
              {data.orchestrations.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-zinc-500">No active orchestrations.</p>
              ) : (
                <ul className="divide-y divide-axiom-border">
                  {data.orchestrations.slice(0, 12).map((o) => (
                    <li key={o.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge tone={riskToneFor(o.riskLevel)}>{o.riskLevel}</Badge>
                            <Badge tone={statusToneFor(o.status)}>{o.status.replace(/_/g, " ")}</Badge>
                            <span className="text-[10px] font-mono text-zinc-500">stage · {o.stage.replace(/_/g, " ")}</span>
                            <span className="text-[10px] font-mono text-zinc-600">·</span>
                            <span className="text-[10px] font-mono text-zinc-500">{o.provider}</span>
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{o.title}</p>
                          {o.description && <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{o.description}</p>}
                        </div>
                        {o.safeNextAction?.href && (
                          <a href={`https://visionxixlabs.com${o.safeNextAction.href}`} target="_blank" rel="noreferrer" className="btn-ghost shrink-0">
                            Open ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {/* Active locks */}
          {data.activeLocks.length > 0 && (
            <section>
              <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">// active execution locks</h2>
              <Card className="p-2">
                <ul className="divide-y divide-axiom-border">
                  {data.activeLocks.map((l) => (
                    <li key={l.id} className="px-4 py-2.5 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-mono">{l.kind} · {l.resourceRef}</span>
                      <span className="text-zinc-500 font-mono">expires {new Date(l.expiresAt).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}
    </ViewShell>
  );
}

function CtrlIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
    </svg>
  );
}
