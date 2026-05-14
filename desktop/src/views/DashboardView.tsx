/**
 * Dashboard view — projects from the live `/api/control-plane/state`
 * response. Renders the canonical posture rail, top KPIs, providers,
 * and the ranked next-best actions the autonomous loop would run.
 */

import { useEffect, useState } from "react";
import { desktopClient, type ControlPlaneStateLite } from "../lib/desktopClient";
import { Card, Kpi, PostureTile, SectionHeader, ViewShell, LoadingState, EmptyState, Badge, statusToneFor, riskToneFor } from "../components/Primitives";

export function DashboardView() {
  const [state, setState] = useState<ControlPlaneStateLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    desktopClient.controlPlaneState().then((res) => {
      if (cancelled) return;
      if (res.ok) setState(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <ViewShell><LoadingState label="Building control plane state…" /></ViewShell>;
  if (error || !state) {
    return (
      <ViewShell>
        <EmptyState
          Icon={ConnIcon}
          title="Not connected to your workspace yet"
          detail={error ?? "Sign in via the web app first, then this view will project live state. The desktop runs against https://visionxixlabs.com — open the web sign-in and your session cookie will be used."}
          action={<a href="https://visionxixlabs.com/auth/signin" className="btn-primary" target="_blank" rel="noreferrer">Open web sign-in</a>}
        />
      </ViewShell>
    );
  }

  const liveCount = state.providers.filter((p) => p.sourceMode === "live").length;

  return (
    <ViewShell>
      <SectionHeader
        kicker="// control plane"
        title="One operating system for every cloud."
        subtitle={`Projecting live state generated ${new Date(state.generatedAt).toLocaleTimeString()} · source mode · ${state.sourceMode}`}
      />

      {/* Top KPIs */}
      <section className="grid grid-cols-4 gap-3">
        <Kpi label="Resources"      value={state.cloudInventory.totalResources} tone="violet" />
        <Kpi label="Providers live" value={`${liveCount} / ${state.providers.length}`} tone="emerald" />
        <Kpi label="Risks"          value={state.risks.length}    tone="rose"    delta={state.blockers.length > 0 ? `${state.blockers.length} blocker(s)` : "no blockers"} deltaTone={state.blockers.length > 0 ? "down" : "neutral"} />
        <Kpi label="Next actions"   value={state.nextBestActions.length} tone="cyan" />
      </section>

      {/* Posture rail */}
      <section>
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">// posture</h2>
        <div className="grid grid-cols-4 gap-3">
          <PostureTile label="Security"    score={state.securityPosture.score}    status={state.securityPosture.status}    detail={state.securityPosture.summary} />
          <PostureTile label="Reliability" score={state.reliabilityPosture.score} status={state.reliabilityPosture.status} detail={state.reliabilityPosture.summary} />
          <PostureTile label="ReleaseOps"  score={state.releaseOpsPosture.score}  status={state.releaseOpsPosture.status}  detail={state.releaseOpsPosture.summary} />
          <PostureTile label="Validation"  score={state.validationPosture.score}  status={state.validationPosture.status}  detail={state.validationPosture.summary} />
        </div>
      </section>

      {/* Provider snapshot */}
      <section>
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">// providers</h2>
        <div className="grid grid-cols-3 gap-3">
          {state.providers.map((p) => (
            <Card key={p.provider} className="p-5" tint={p.provider === "aws" ? "amber" : p.provider === "azure" ? "cyan" : "emerald"}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-white uppercase tracking-tight">{p.provider}</h3>
                <Badge tone={statusToneFor(p.connectionStatus)}>{p.connectionStatus}</Badge>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">resource kinds</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.entries(p.resourceCounts).length === 0
                  ? <span className="text-[11px] text-zinc-600">none yet</span>
                  : Object.entries(p.resourceCounts).map(([k, v]) => (
                      <span key={k} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.04]">{k}: {v}</span>
                    ))}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between">
                <span>scan · {p.scanStatus}</span>
                <span>conf · {(p.confidence * 100).toFixed(0)}%</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Next-best actions */}
      <section>
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">// next best actions</h2>
        <Card className="p-2">
          <ul className="divide-y divide-axiom-border">
            {state.nextBestActions.slice(0, 8).map((a) => (
              <li key={a.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">prio {a.priority}</span>
                      <Badge tone={riskToneFor(a.riskLevel)}>{a.riskLevel}</Badge>
                      {a.approvalRequired && <Badge tone="warning">approval</Badge>}
                      <span className="text-[10px] font-mono text-zinc-600">{a.category}</span>
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{a.description}</p>
                  </div>
                  {a.route && (
                    <a
                      href={`https://visionxixlabs.com${a.route}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 btn-ghost"
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Honest footer */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <p className="text-[10px] font-mono text-amber-300 uppercase tracking-[0.22em] mb-2">// honest limitations</p>
        <ul className="space-y-1 text-[12px] text-zinc-300">
          <li>• Posture scores are projected from the live web platform — connect a provider for live signals.</li>
          <li>• Local apply is intentionally blocked from desktop; every action routes through the governed orchestration center.</li>
          <li>• This window updates on view enter — refresh by reopening the dashboard.</li>
        </ul>
      </section>
    </ViewShell>
  );
}

function ConnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
