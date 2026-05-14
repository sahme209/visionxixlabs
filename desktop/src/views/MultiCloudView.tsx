/**
 * Multi-cloud view — AWS / Azure / GCP side-by-side from the live
 * control plane.
 */

import { useEffect, useState } from "react";
import { desktopClient, type ControlPlaneStateLite } from "../lib/desktopClient";
import { Card, SectionHeader, ViewShell, LoadingState, EmptyState, Badge, statusToneFor } from "../components/Primitives";

export function MultiCloudView() {
  const [state, setState] = useState<ControlPlaneStateLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    desktopClient.controlPlaneState().then((res) => {
      if (cancelled) return;
      if (res.ok) setState(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <ViewShell><LoadingState label="Composing multi-cloud overview…" /></ViewShell>;
  if (error || !state) {
    return (
      <ViewShell>
        <EmptyState
          Icon={CloudIcon}
          title="No cloud state available"
          detail={error ?? "Connect AWS, Azure, or GCP in the web app to populate this view."}
          action={<a href="https://visionxixlabs.com/operator/onboarding" target="_blank" rel="noreferrer" className="btn-primary">Connect a provider</a>}
        />
      </ViewShell>
    );
  }

  const TONE: Record<string, "amber" | "cyan" | "emerald"> = { aws: "amber", azure: "cyan", gcp: "emerald" };

  return (
    <ViewShell>
      <SectionHeader
        kicker="// multi-cloud"
        title="AWS · Azure · GCP — one view."
        subtitle={`Source mode · ${state.sourceMode} · ${state.cloudInventory.totalResources} resources across ${state.providers.length} provider(s).`}
      />

      <section className="grid grid-cols-3 gap-3">
        {state.providers.map((p) => (
          <Card key={p.provider} className="p-6" tint={TONE[p.provider]}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold tracking-tight text-white uppercase">{p.provider}</h2>
              <Badge tone={statusToneFor(p.connectionStatus)}>{p.connectionStatus}</Badge>
            </div>

            <div className="space-y-1 mb-4 text-[11px] font-mono">
              <Row label="mode"       value={p.mode} />
              <Row label="validation" value={p.validationStatus} />
              <Row label="scan"       value={p.scanStatus} />
              <Row label="source"     value={p.sourceMode} />
              <Row label="confidence" value={`${(p.confidence * 100).toFixed(0)}%`} />
            </div>

            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">resource kinds</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(p.resourceCounts).length === 0
                ? <span className="text-[11px] text-zinc-600">no inventory yet</span>
                : Object.entries(p.resourceCounts).map(([k, v]) => (
                  <span key={k} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.04]">{k}: {v}</span>
                ))}
            </div>

            {p.topFindings.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">top finding</p>
                <p className="text-[12px] text-zinc-200 font-mono">{p.topFindings[0].ruleCode}</p>
                <p className="text-[10.5px] text-zinc-500">risk · {p.topFindings[0].risk} · {p.topFindings[0].resourceRef}</p>
              </div>
            )}

            {p.missingCapabilities.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">missing</p>
                <ul className="space-y-0.5 text-[11px] text-zinc-400">
                  {p.missingCapabilities.slice(0, 4).map((m) => <li key={m}>• {m}</li>)}
                </ul>
              </div>
            )}

            {p.nextAction && (
              <a
                href={p.nextAction.href ? `https://visionxixlabs.com${p.nextAction.href}` : "https://visionxixlabs.com/operator/onboarding"}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary w-full justify-center text-[12px]"
              >
                {p.nextAction.label} →
              </a>
            )}
          </Card>
        ))}
      </section>

      {/* Cost + reliability footer */}
      <section className="grid grid-cols-3 gap-3">
        <Card className="p-5"><Row label="Total monthly cost"  value="—  (preview)" /></Card>
        <Card className="p-5"><Row label="Reliability score"   value={`${state.reliabilityPosture.score}/100`} /></Card>
        <Card className="p-5"><Row label="ReleaseOps grade"    value={state.releaseOpsPosture.summary.split(" ")[1] ?? "—"} /></Card>
      </section>
    </ViewShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19a4.5 4.5 0 1 0 0-9c-.4-3.4-3.3-6-6.8-6a6.8 6.8 0 0 0-6.7 6 5 5 0 0 0 1 9.9h12.5z" />
    </svg>
  );
}
