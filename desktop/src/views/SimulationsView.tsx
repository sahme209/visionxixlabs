/**
 * Simulations view — preflights every remediation candidate against the
 * digital twin and renders risk/impact/blockers/approvals per result.
 */

import { useEffect, useState } from "react";
import { desktopClient, type SimulationsBatchLite } from "../lib/desktopClient";
import { Card, DataSourceBanner, SectionHeader, ViewShell, LoadingState, EmptyState, Badge, Kpi, statusToneFor } from "../components/Primitives";

export function SimulationsView() {
  const [batch, setBatch] = useState<SimulationsBatchLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    desktopClient.simulationsBatch().then((res) => {
      if (cancelled) return;
      if (res.ok) setBatch(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <ViewShell><LoadingState label="Building twin + running simulations…" /></ViewShell>;
  if (error || !batch) {
    return (
      <ViewShell>
        <EmptyState
          Icon={LayersIcon}
          title="No simulations yet"
          detail={error ?? "Connect a provider so remediation candidates appear, then this view simulates each one against the digital twin."}
          action={<a href="https://visionxixlabs.com/dashboard/simulations" target="_blank" rel="noreferrer" className="btn-primary">Open in web</a>}
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell>
      <DataSourceBanner
        mode={desktopClient.isPreviewMode
          ? (desktopClient.hasAuth() ? "authenticated_no_data" : "preview")
          : "live"}
        surfaceName="change-set simulations"
        webPath="/dashboard/simulations"
      />
      <SectionHeader
        kicker="// simulations"
        title="Preflight every change against the digital twin."
        subtitle={`Twin id · ${batch.twinId} · generated ${new Date(batch.generatedAt).toLocaleTimeString()}`}
      />

      <section className="grid grid-cols-5 gap-3">
        <Kpi label="Total"        value={batch.summary.total}        tone="violet" />
        <Kpi label="Simulated"    value={batch.summary.simulated}    tone="emerald" />
        <Kpi label="Preview only" value={batch.summary.preview_only} tone="cyan" />
        <Kpi label="Blocked"      value={batch.summary.blocked}      tone="rose" />
        <Kpi label="Unsafe"       value={batch.summary.unsafe}       tone="amber" />
      </section>

      <section className="space-y-2">
        {batch.results.slice(0, 12).map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={statusToneFor(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
                <Badge tone="cyan">impact · {r.impact.overallImpact}</Badge>
                <span className="text-[10px] font-mono text-zinc-500">security delta · {r.delta.security}</span>
                <span className="text-[10px] font-mono text-zinc-600">·</span>
                <span className="text-[10px] font-mono text-zinc-500">rollback · {r.rollbackFeasibility}</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">conf · {(r.confidence * 100).toFixed(0)}%</span>
            </div>
            <p className="text-sm text-zinc-200 mb-3">{r.summary}</p>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <Sub label="direct affected"   value={`${r.impact.directlyAffected.length}`} />
              <Sub label="indirect affected" value={`${r.impact.indirectlyAffected.length}`} />
              <Sub label="approvals required" value={`${r.approvalsRequired.length}`} />
            </div>
            {r.blockers.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-mono text-rose-300 uppercase tracking-[0.18em] mb-1">blockers</p>
                <ul className="space-y-0.5 text-[11px] text-zinc-400">
                  {r.blockers.map((b, i) => <li key={i}>• {b.reason}</li>)}
                </ul>
              </div>
            )}
            {r.safeNextAction?.href && (
              <div className="mt-3 flex items-center justify-end">
                <a href={`https://visionxixlabs.com${r.safeNextAction.href}`} target="_blank" rel="noreferrer" className="btn-secondary text-[11px]">
                  {r.safeNextAction.label} →
                </a>
              </div>
            )}
          </Card>
        ))}
      </section>
    </ViewShell>
  );
}

function Sub({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-axiom-border bg-axiom-bg-elev/50 px-2.5 py-1.5">
      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{label}</p>
      <p className="text-[12px] tabular-mono text-zinc-200 mt-0.5">{value}</p>
    </div>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
