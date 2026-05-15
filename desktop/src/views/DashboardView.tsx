/**
 * Dashboard view — projects from `/api/control-plane/state` or falls
 * back to realistic mock data when the desktop can't share cross-origin
 * cookies with the web app. Always renders the full UI with a clear
 * preview-mode banner when not connected.
 */

import { useEffect, useState } from "react";
import { desktopClient, type ControlPlaneStateLite } from "../lib/desktopClient";
import { Card, Kpi, PostureTile, SectionHeader, ViewShell, LoadingState, Badge, statusToneFor, riskToneFor } from "../components/Primitives";

export function DashboardView() {
  const [state, setState] = useState<ControlPlaneStateLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    desktopClient.controlPlaneState().then((res) => {
      if (cancelled) return;
      if (res.ok) setState(res.data);
      setPreviewMode(desktopClient.isPreviewMode);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading || !state) return <ViewShell><LoadingState label="Composing control plane state…" /></ViewShell>;

  const liveCount = state.providers.filter((p) => p.sourceMode === "live").length;

  return (
    <ViewShell>
      {previewMode && <PreviewBanner />}

      <SectionHeader
        kicker="// control plane"
        title="One operating system for every cloud."
        subtitle={`Snapshot ${new Date(state.generatedAt).toLocaleTimeString()} · source mode · ${state.sourceMode}`}
      />

      <section className="grid grid-cols-4 gap-3">
        <Kpi label="Resources"      value={state.cloudInventory.totalResources} tone="violet" />
        <Kpi label="Providers live" value={`${liveCount} / ${state.providers.length}`} tone="emerald" />
        <Kpi label="Risks"          value={state.risks.length}    tone="rose"    delta={state.blockers.length > 0 ? `${state.blockers.length} blocker(s)` : "no blockers"} deltaTone={state.blockers.length > 0 ? "down" : "neutral"} />
        <Kpi label="Next actions"   value={state.nextBestActions.length} tone="cyan" />
      </section>

      <section>
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">// posture</h2>
        <div className="grid grid-cols-4 gap-3">
          <PostureTile label="Security"    score={state.securityPosture.score}    status={state.securityPosture.status}    detail={state.securityPosture.summary} />
          <PostureTile label="Reliability" score={state.reliabilityPosture.score} status={state.reliabilityPosture.status} detail={state.reliabilityPosture.summary} />
          <PostureTile label="ReleaseOps"  score={state.releaseOpsPosture.score}  status={state.releaseOpsPosture.status}  detail={state.releaseOpsPosture.summary} />
          <PostureTile label="Validation"  score={state.validationPosture.score}  status={state.validationPosture.status}  detail={state.validationPosture.summary} />
        </div>
      </section>

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
    </ViewShell>
  );
}

// ---------------------------------------------------------------------------
// Preview-mode banner — Huly-grade cinematic call-to-connect
// ---------------------------------------------------------------------------

function PreviewBanner() {
  return (
    <div className="relative rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.10] via-fuchsia-500/[0.06] to-cyan-500/[0.04] p-6 overflow-hidden animate-fade-in-up">
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-violet-500/20 blur-[80px] pointer-events-none" aria-hidden />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-fuchsia-500/15 blur-[60px] pointer-events-none" aria-hidden />
      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet shrink-0">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08 4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08 4.24-4.24" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono font-semibold text-violet-300 uppercase tracking-[0.22em]">preview mode</span>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight mb-1.5">Showing realistic mock data — sign in to load live state.</h3>
            <p className="text-[12px] text-zinc-400 leading-relaxed max-w-xl">
              The desktop runs against <span className="font-mono text-zinc-300">visionxixlabs.com</span> but cross-origin cookies can&apos;t flow from your browser. Sign in via the web first; the desktop will then project your real workspace.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://visionxixlabs.com/auth/signin?callbackUrl=/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[12px] font-semibold shadow-glow-violet transition-all"
          >
            Sign in via web →
          </a>
          <a
            href="https://visionxixlabs.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-200 text-[12px] font-semibold transition-all"
          >
            Open web app
          </a>
        </div>
      </div>
    </div>
  );
}
