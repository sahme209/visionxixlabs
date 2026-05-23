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

interface V1PipelineRunDetail {
  id: string;
  pipelineId: string;
  status: string;
  triggeredBy: string;
  correlationId: string;
  startedAt: string;
  completedAt: string | null;
  errorSummary: string | null;
  stages: ReadonlyArray<{
    id: string;
    stageId: string;
    stageKind: string;
    ordering: number;
    status: string;
    completedAt: string | null;
    errorMessage: string | null;
  }>;
}

/** How often to poll the runs list while any row is still in flight. */
const LIVE_POLL_MS = 5_000;

export function OrchestrationView() {
  const [data, setData] = useState<OrchestrationListLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionMsg, setDecisionMsg] = useState<string | null>(null);
  // v1 pipeline runs from Phase 396 — live data when an API key is paired.
  const [v1Runs, setV1Runs] = useState<ReadonlyArray<V1PipelineRun> | null>(null);
  const [v1RunsError, setV1RunsError] = useState<string | null>(null);

  // Trigger-run form state (Phase 396 POST surface + Phase 402 idempotency).
  const [triggerInstruction, setTriggerInstruction] = useState("");
  const [triggerRepoRef,     setTriggerRepoRef]     = useState("");
  const [triggerBranchHint,  setTriggerBranchHint]  = useState("main");
  const [triggering,         setTriggering]         = useState(false);
  const [triggerResult,      setTriggerResult]      = useState<
    | { kind: "ok"; runId: string; correlationId: string; pollUrl: string }
    | { kind: "err"; message: string }
    | null
  >(null);

  // Drill-down panel state: clicking a row opens the per-run detail
  // (stages + errors). Fetched lazily via v1GetPipelineRun.
  const [drillOpenRunId, setDrillOpenRunId] = useState<string | null>(null);
  const [drillDetail,    setDrillDetail]    = useState<V1PipelineRunDetail | null>(null);
  const [drillLoading,   setDrillLoading]   = useState(false);
  const [drillError,     setDrillError]     = useState<string | null>(null);

  /** Generate a Phase-402-compliant idempotency key per click. */
  function newIdempotencyKey(): string {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch { /* fall through */ }
    // Fallback: timestamp + 32 chars of randomness (matches the
    // [A-Za-z0-9_\-./:]{8,255} server regex).
    const r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return `desktop_${Date.now().toString(36)}_${r.slice(0, 24)}`;
  }

  const handleTrigger = async () => {
    if (!triggerInstruction.trim() || !triggerRepoRef.trim()) return;
    setTriggering(true);
    setTriggerResult(null);
    const res = await desktopClient.v1TriggerCodingRun({
      instruction: triggerInstruction.trim(),
      repoRef:     triggerRepoRef.trim(),
      branchHint:  triggerBranchHint.trim() || undefined,
      metadata:    { _via: "desktop_orchestration_view" },
      idempotencyKey: newIdempotencyKey(),
    });
    if (res.ok) {
      const d = res.data as { runId: string; correlationId: string; pollUrl: string };
      setTriggerResult({ kind: "ok", runId: d.runId, correlationId: d.correlationId, pollUrl: d.pollUrl });
      setTriggerInstruction("");
      // Refresh the list so the new run appears at the top.
      refresh();
    } else {
      setTriggerResult({ kind: "err", message: res.error });
    }
    setTriggering(false);
  };

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

  /**
   * Live polling: when any v1 run is still in flight, refresh the list
   * every LIVE_POLL_MS. Effect re-runs whenever v1Runs changes — once
   * everything terminates, the interval clears itself.
   */
  useEffect(() => {
    if (!v1Runs) return;
    const hasInFlight = v1Runs.some(
      (r) => r.status === "running" || r.status === "queued" || r.status === "awaiting_approval",
    );
    if (!hasInFlight) return;
    if (!desktopClient.hasAuth()) return;
    const interval = setInterval(() => {
      desktopClient.v1ListPipelineRuns({ limit: 10 }).then((res) => {
        if (!res.ok) return;
        const d = res.data as { runs: ReadonlyArray<V1PipelineRun> };
        setV1Runs(d.runs);
      });
      // If a drill-down is open and its run is still in flight, refresh
      // that too so the stages panel reflects live progress.
      if (drillOpenRunId) {
        const stillRunning = v1Runs.find((r) => r.id === drillOpenRunId);
        if (stillRunning && (stillRunning.status === "running" || stillRunning.status === "queued")) {
          loadDrillDetail(drillOpenRunId);
        }
      }
    }, LIVE_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v1Runs, drillOpenRunId]);

  const loadDrillDetail = async (runId: string) => {
    setDrillLoading(true);
    setDrillError(null);
    const res = await desktopClient.v1GetPipelineRun(runId);
    if (res.ok) {
      const d = res.data as { run: V1PipelineRunDetail };
      setDrillDetail(d.run);
    } else {
      setDrillDetail(null);
      setDrillError(res.error);
    }
    setDrillLoading(false);
  };

  const openDrill = (runId: string) => {
    setDrillOpenRunId(runId);
    setDrillDetail(null);
    loadDrillDetail(runId);
  };

  const closeDrill = () => {
    setDrillOpenRunId(null);
    setDrillDetail(null);
    setDrillError(null);
  };

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

      {/* Trigger pipeline run — Phase 396 POST + Phase 402 idempotency.
          Only renders when an API key is paired (otherwise the call would
          just 401 and the form would be a tease). */}
      {desktopClient.hasAuth() && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em]">// trigger a coding run</h2>
          <Card className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">repository</label>
                <input
                  type="text"
                  value={triggerRepoRef}
                  onChange={(e) => setTriggerRepoRef(e.target.value)}
                  placeholder="owner/repo"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">branch</label>
                <input
                  type="text"
                  value={triggerBranchHint}
                  onChange={(e) => setTriggerBranchHint(e.target.value)}
                  placeholder="main"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">instruction</label>
              <textarea
                rows={3}
                value={triggerInstruction}
                onChange={(e) => setTriggerInstruction(e.target.value)}
                placeholder="e.g. Add a /healthz route that returns { status: 'ok' } and write a vitest test for it."
                className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 resize-none"
              />
            </div>

            {triggerResult?.kind === "ok" && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] p-3 text-[12px] space-y-1">
                <p className="text-emerald-300 font-mono">
                  ✓ Run started · <span className="text-zinc-200">{triggerResult.runId}</span>
                </p>
                <p className="text-[11px] text-zinc-500 font-mono">
                  correlation id · {triggerResult.correlationId}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono">
                  poll · {triggerResult.pollUrl}
                </p>
              </div>
            )}
            {triggerResult?.kind === "err" && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/[0.08] p-3 text-[12px] text-red-300">
                ✗ Trigger failed: <span className="font-mono">{triggerResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono text-zinc-500">
                Scope required: <span className="text-zinc-400">pipeline:trigger</span> · sends a fresh Idempotency-Key per click so retries are safe.
              </p>
              <button
                onClick={handleTrigger}
                disabled={triggering || !triggerInstruction.trim() || !triggerRepoRef.trim()}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
              >
                {triggering ? "Triggering…" : "Trigger run →"}
              </button>
            </div>
          </Card>
        </section>
      )}

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
                {v1Runs.map((r) => {
                  const isOpen = drillOpenRunId === r.id;
                  const isInFlight = r.status === "running" || r.status === "queued" || r.status === "awaiting_approval";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => (isOpen ? closeDrill() : openDrill(r.id))}
                      className={`border-t border-axiom-border cursor-pointer transition-colors ${
                        isOpen ? "bg-violet-500/[0.06]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-4 py-2 text-zinc-200 flex items-center gap-2">
                        <span className={`text-[10px] ${isOpen ? "text-violet-300" : "text-zinc-600"}`}>{isOpen ? "▼" : "▶"}</span>
                        {r.id.slice(0, 18)}…
                        {isInFlight && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" title="live · auto-refreshing" />
                        )}
                      </td>
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
                  );
                })}
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

      {/* Run drill-down — populated lazily when a row is clicked. */}
      {drillOpenRunId && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em]">
              // run detail · <span className="text-violet-300">{drillOpenRunId.slice(0, 18)}…</span>
            </h2>
            <button
              onClick={closeDrill}
              className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              close ✕
            </button>
          </div>
          <Card className="p-5 border border-violet-500/15">
            {drillLoading && !drillDetail && (
              <p className="text-[12px] font-mono text-zinc-500">Loading stages…</p>
            )}
            {drillError && !drillDetail && (
              <p className="text-[12px] text-red-300">
                ✗ Failed to load run: <span className="font-mono">{drillError}</span>
              </p>
            )}
            {drillDetail && (
              <div className="space-y-4">
                {/* Header row — status + key timestamps + correlation id. */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={
                        drillDetail.status === "succeeded" ? "success" :
                        drillDetail.status === "failed"    ? "danger" :
                        drillDetail.status === "running"   ? "cyan" :
                                                             "warning"
                      }>{drillDetail.status}</Badge>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {drillDetail.pipelineId}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-500">
                      triggered by · <span className="text-zinc-300">{drillDetail.triggeredBy}</span>
                    </p>
                    <p className="text-[11px] font-mono text-zinc-500">
                      correlation · <span className="text-zinc-400">{drillDetail.correlationId}</span>
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 text-right space-y-1">
                    <p>started · <span className="text-zinc-300">{new Date(drillDetail.startedAt).toLocaleString()}</span></p>
                    <p>completed · <span className="text-zinc-300">{drillDetail.completedAt ? new Date(drillDetail.completedAt).toLocaleString() : "—"}</span></p>
                  </div>
                </div>

                {drillDetail.errorSummary && (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-3 text-[12px] text-red-300">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-red-400 mr-2">error</span>
                    {drillDetail.errorSummary}
                  </div>
                )}

                {/* Stages timeline */}
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">
                    stages · {drillDetail.stages.length}
                  </p>
                  <ol className="space-y-1.5">
                    {drillDetail.stages.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-start gap-3 rounded-md border border-axiom-border bg-white/[0.02] px-3 py-2"
                      >
                        <span className="text-[10px] font-mono text-zinc-600 tabular-nums w-6 mt-0.5">
                          {String(s.ordering).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-mono text-zinc-200">{s.stageKind}</span>
                            <Badge tone={
                              s.status === "succeeded" ? "success" :
                              s.status === "failed"    ? "danger" :
                              s.status === "running"   ? "cyan" :
                              s.status === "awaiting_approval" ? "warning" :
                                                         "neutral"
                            }>{s.status}</Badge>
                            {s.completedAt && (
                              <span className="text-[10px] font-mono text-zinc-600">
                                · {new Date(s.completedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          {s.errorMessage && (
                            <p className="text-[11px] text-red-300 mt-1 font-mono break-words">
                              {s.errorMessage}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </Card>
        </section>
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
