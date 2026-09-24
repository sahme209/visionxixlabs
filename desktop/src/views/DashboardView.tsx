/**
 * Dashboard view — projects persisted workspace state from the authenticated
 * control-plane API. Missing authentication and service failures render an
 * explicit unavailable state; production screens never substitute mock data.
 */

import { useEffect, useState } from "react";
import type { View } from "../App";
import { desktopClient, type ControlPlaneStateLite } from "../lib/desktopClient";
import { Card, ExternalLink, Kpi, PostureTile, SectionHeader, ViewShell, LoadingState, Badge, statusToneFor, riskToneFor } from "../components/Primitives";
import { OnboardingChecklist } from "../components/OnboardingChecklist";

export function DashboardView({ onNavigate }: { onNavigate?: (v: View) => void } = {}) {
  const [state, setState] = useState<ControlPlaneStateLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    desktopClient.controlPlaneState().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setState(res.data);
        setError(null);
      } else {
        setState(null);
        setError(res.error);
      }
      setPreviewMode(desktopClient.isPreviewMode);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <ViewShell><LoadingState label="Loading control plane state…" /></ViewShell>;
  if (error || !state) {
    return (
      <ViewShell>
        <Card className="p-6" tint="rose">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-300 mb-2">workspace unavailable</p>
          <h2 className="text-lg font-semibold text-white">No operational data was loaded.</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {error ?? "Connect an authenticated workspace in Settings, then try again."}
          </p>
          <p className="mt-3 text-xs text-zinc-500">No sample records or simulated success state are shown in the installed application.</p>
        </Card>
      </ViewShell>
    );
  }

  const liveCount = state.providers.filter((p) => p.sourceMode === "live").length;

  return (
    <ViewShell>
      <AuthStatusBanner previewMode={previewMode} />

      <OnboardingChecklist onNavigate={onNavigate} />

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
                    <ExternalLink
                      href={`https://visionxixlabs.com${a.route}`}
                      className="shrink-0 btn-ghost"
                    >
                      Open ↗
                    </ExternalLink>
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

// ---------------------------------------------------------------------------
// Auth status banner — three states based on whether a vxlk_* API key is
// loaded AND whether `/api/v1/whoami` succeeds. Replaces the static
// "preview mode" call-to-connect with real authenticated context.
// ---------------------------------------------------------------------------

interface WhoamiSummary {
  organizationId: string;
  planTier: string;
  scopes: ReadonlyArray<string>;
  gate?: {
    passed: boolean;
    passRate: number;
    summary: string;
  };
}

function AuthStatusBanner({ previewMode }: { previewMode: boolean }) {
  const [whoami, setWhoami] = useState<WhoamiSummary | "loading" | "no_auth" | "auth_failed">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!desktopClient.hasAuth()) {
      setWhoami("no_auth");
      return;
    }
    (async () => {
      const r = await desktopClient.v1Whoami();
      if (cancelled) return;
      if (!r.ok) {
        setWhoami("auth_failed");
        return;
      }
      const d = r.data as {
        apiKey: { scopes: ReadonlyArray<string> };
        organization: { id: string; planTier: string };
      };
      const gateRes = await desktopClient.v1ReleaseGate();
      if (cancelled) return;
      let gateData: WhoamiSummary["gate"];
      if (gateRes.ok) {
        const g = (gateRes.data as { gate?: { passed: boolean; passRate: number; summary: string } }).gate;
        if (g) gateData = g;
      }
      setWhoami({
        organizationId: d.organization.id,
        planTier: d.organization.planTier,
        scopes: d.apiKey.scopes,
        gate: gateData,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // Live state — show the real workspace + release-gate verdict.
  if (whoami !== "loading" && whoami !== "no_auth" && whoami !== "auth_failed") {
    const gatePass = whoami.gate?.passed === true;
    return (
      <div className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-cyan-500/[0.04] to-violet-500/[0.04] p-5 overflow-hidden animate-fade-in-up">
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl ${gatePass ? "bg-emerald-500/20" : "bg-amber-500/20"} flex items-center justify-center shrink-0`}>
              <svg className={`h-5 w-5 ${gatePass ? "text-emerald-300" : "text-amber-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {gatePass
                  ? <><path d="M20 6 9 17l-5-5"/></>
                  : <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>}
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-semibold text-emerald-300 uppercase tracking-[0.22em]">live · authenticated</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mb-1">
                Signed in as <span className="font-mono text-violet-300">{whoami.organizationId}</span>{" "}
                <span className="text-zinc-500">·</span>{" "}
                <span className="font-mono text-zinc-300">{whoami.planTier}</span>
              </h3>
              {whoami.gate ? (
                <p className="text-[12px] text-zinc-400 leading-relaxed max-w-2xl">
                  Release gate: <span className={`font-mono ${gatePass ? "text-emerald-300" : "text-amber-300"}`}>{gatePass ? "PASSED" : "BLOCKED"}</span>{" "}
                  · pass rate <span className="font-mono text-zinc-300">{(whoami.gate.passRate * 100).toFixed(1)}%</span>{" "}
                  · {whoami.gate.summary}
                </p>
              ) : (
                <p className="text-[12px] text-zinc-500">No eval run snapshot yet for this workspace.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state (auth in flight).
  if (whoami === "loading") {
    return (
      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/40 p-4">
        <p className="text-[12px] font-mono text-zinc-500">Verifying API key…</p>
      </div>
    );
  }

  // Auth failed — present a recovery path.
  if (whoami === "auth_failed") {
    return (
      <div className="relative rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/[0.10] via-rose-500/[0.06] to-zinc-900/0 p-6 overflow-hidden animate-fade-in-up">
        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-semibold text-red-300 uppercase tracking-[0.22em]">authentication failed</span>
          </div>
          <h3 className="text-base font-bold text-white tracking-tight mb-1.5">Stored API key is invalid, revoked, or expired.</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed max-w-2xl">
            The desktop tried to call <span className="font-mono text-zinc-300">/api/v1/whoami</span> with the stored key and was rejected.
            Open <span className="font-mono text-zinc-300">Settings → VisionXIXLabs API key</span>, remove the existing key, and paste a freshly-minted one.
          </p>
        </div>
      </div>
    );
  }

  // No auth — preview-mode banner (same shape as before, but the buttons
  // now point the user at the Settings page where they can actually
  // paste an API key).
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
              <span className="text-[10px] font-mono font-semibold text-violet-300 uppercase tracking-[0.22em]">{previewMode ? "preview mode" : "not authenticated"}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight mb-1.5">Connect a workspace API key to load live state.</h3>
            <p className="text-[12px] text-zinc-400 leading-relaxed max-w-xl">
              Mint a key on the web at{" "}
              <span className="font-mono text-zinc-300">visionxixlabs.com/admin/api-keys</span>{" "}
              with scope <span className="font-mono text-zinc-300">release_gate:read</span> (or broader), then paste it in{" "}
              <span className="font-mono text-zinc-300">Settings → VisionXIXLabs API key</span>. The desktop will switch from mock data to your real workspace immediately.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExternalLink
            href="https://visionxixlabs.com/admin/api-keys"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[12px] font-semibold shadow-glow-violet transition-all"
          >
            Mint an API key →
          </ExternalLink>
          <ExternalLink
            href="https://visionxixlabs.com/demo"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-200 text-[12px] font-semibold transition-all"
          >
            Explore web demo
          </ExternalLink>
        </div>
      </div>
    </div>
  );
}
