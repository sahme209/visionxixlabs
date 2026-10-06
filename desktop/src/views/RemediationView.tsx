/**
 * Remediation view — per-candidate Terraform + CLI + rollback +
 * verification + readiness, projected from /api/remediation/plan.
 */

import { useEffect, useState } from "react";
import { desktopClient, type RemediationPipelineLite } from "../lib/desktopClient";
import { Card, DataSourceBanner, ExternalLink, SectionHeader, ViewShell, LoadingState, EmptyState, Badge, riskToneFor, statusToneFor, Kpi } from "../components/Primitives";

export function RemediationView() {
  const [pipeline, setPipeline] = useState<RemediationPipelineLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    desktopClient.remediationPlan().then((res) => {
      if (cancelled) return;
      if (res.ok) setPipeline(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <ViewShell><LoadingState label="Composing remediation candidates…" /></ViewShell>;
  if (error || !pipeline) {
    return (
      <ViewShell>
        <EmptyState
          Icon={WrenchIcon}
          title="No remediation candidates yet"
          detail={error ?? "Run a security scan or connect a provider — every finding becomes a typed remediation candidate with Terraform / CLI / rollback / verification."}
          action={<ExternalLink href="https://visionxixlabs.com/admin/api-keys" className="btn-primary">Pair workspace</ExternalLink>}
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
        surfaceName="remediation candidates"
        webPath="/dashboard/remediation"
      />
      <SectionHeader
        kicker="// remediation"
        title="Governed fixes from every finding."
        subtitle={`${pipeline.summary.total} candidate(s) · ${pipeline.summary.approvalGated} approval-gated · ${pipeline.summary.desktopEligible} desktop-eligible · ${pipeline.summary.blocked} blocked.`}
      />

      <section className="grid grid-cols-4 gap-3">
        <Kpi label="Candidates"        value={pipeline.summary.total}            tone="violet" />
        <Kpi label="Approval-gated"    value={pipeline.summary.approvalGated}    tone="amber" />
        <Kpi label="Desktop-eligible"  value={pipeline.summary.desktopEligible}  tone="cyan" />
        <Kpi label="Policy-blocked"    value={pipeline.summary.blocked}          tone="rose" />
      </section>

      <section className="space-y-2">
        {pipeline.bundles.slice(0, 12).map((b) => {
          const isOpen = openId === b.candidate.id;
          return (
            <Card key={b.candidate.id} className="p-0 overflow-hidden">
              <button
                className="w-full px-5 py-4 text-left flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                onClick={() => setOpenId(isOpen ? null : b.candidate.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge tone={riskToneFor(b.candidate.riskLevel)}>{b.candidate.riskLevel}</Badge>
                    <Badge tone={statusToneFor(b.finalStatus)}>{b.finalStatus.replace(/_/g, " ")}</Badge>
                    <span className="text-[10px] font-mono text-zinc-500">{b.candidate.category}</span>
                    <span className="text-[10px] font-mono text-zinc-600">·</span>
                    <span className="text-[10px] font-mono text-zinc-500">{b.candidate.provider}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{b.candidate.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{b.candidate.impactSummary}</p>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-zinc-500">readiness · {b.readiness.decision}</span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 grid grid-cols-2 gap-3 border-t border-axiom-border bg-axiom-bg/40">
                  <DetailCard title="Terraform preview" subtitle={b.terraform.fileName}>
                    {b.terraform.manualReviewRequired ? (
                      <p className="text-[11px] text-zinc-300">Manual review required — no canonical HCL template.</p>
                    ) : (
                      <pre className="text-[10.5px] font-mono text-zinc-300 bg-black/40 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre">{b.terraform.hcl}</pre>
                    )}
                    <p className="text-[11px] text-zinc-500 mt-2">{b.terraform.explanation}</p>
                  </DetailCard>

                  <DetailCard title="CLI preview" subtitle={b.cli.cli}>
                    {b.cli.manualReviewRequired ? (
                      <p className="text-[11px] text-zinc-300">Manual review required — no canonical CLI template.</p>
                    ) : (
                      <pre className="text-[10.5px] font-mono text-zinc-300 bg-black/40 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">{b.cli.command}</pre>
                    )}
                    <p className="text-[11px] text-zinc-500 mt-2">{b.cli.explanation}</p>
                  </DetailCard>

                  <DetailCard title="Rollback" subtitle={`complexity · ${b.rollback.rollbackComplexity}`}>
                    <p className="text-[11px] text-zinc-300 mb-2">{b.rollback.rollbackAvailable ? "Available" : "Not available — one-way change."}</p>
                    <ul className="space-y-1 text-[11px] text-zinc-400">
                      {b.rollback.rollbackSteps.slice(0, 4).map((s) => <li key={s.ordinal}>{s.ordinal}. {s.detail}</li>)}
                    </ul>
                  </DetailCard>

                  <DetailCard title="Verification" subtitle={`mode · ${b.verification.manualOrAutomated}`}>
                    <ul className="space-y-1 text-[11px] text-zinc-400">
                      {b.verification.checks.slice(0, 4).map((c) => (
                        <li key={c.ordinal}>{c.ordinal}. {c.title} <span className="text-zinc-600">({c.execution})</span></li>
                      ))}
                    </ul>
                  </DetailCard>

                  <div className="col-span-2 rounded-lg border border-axiom-border bg-axiom-bg-elev/60 p-3 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-300">{b.readiness.reason}</span>
                    {b.readiness.safeNextAction?.href && (
                      <ExternalLink
                        href={`https://visionxixlabs.com${b.readiness.safeNextAction.href}`}
                        className="btn-secondary text-[11px]"
                      >
                        {b.readiness.safeNextAction.label} →
                      </ExternalLink>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </section>

      <section className="rounded-xl border border-white/20 bg-white/[0.04] p-4">
        <p className="text-[10px] font-mono text-zinc-300 uppercase tracking-[0.22em] mb-1.5">// honest limitations</p>
        <p className="text-[12px] text-zinc-300">This release does not execute remediation locally. Apply remains disabled until the installed runtime can verify a signed approval and tenant policy.</p>
      </section>
    </ViewShell>
  );
}

function DetailCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-axiom-border bg-axiom-bg/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.18em]">{title}</span>
        {subtitle && <span className="text-[10px] font-mono text-zinc-600">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
