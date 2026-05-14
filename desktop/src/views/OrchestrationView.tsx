/**
 * Orchestration view — live orchestrations + approvals + active locks
 * from /api/orchestration. Provides one-click approve/reject for
 * pending approvals.
 */

import { useEffect, useState } from "react";
import { desktopClient, type OrchestrationListLite } from "../lib/desktopClient";
import { Card, SectionHeader, ViewShell, LoadingState, EmptyState, Badge, Kpi, statusToneFor, riskToneFor } from "../components/Primitives";

export function OrchestrationView() {
  const [data, setData] = useState<OrchestrationListLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionMsg, setDecisionMsg] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    desktopClient.orchestration().then((res) => {
      if (res.ok) setData(res.data);
      else setError(res.error);
      setLoading(false);
    });
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
