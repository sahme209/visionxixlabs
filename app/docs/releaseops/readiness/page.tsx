import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Readiness scoring — ReleaseOps Documentation",
  description: "How Axiom computes Release Readiness across 9 operational dimensions, what each dimension measures, and how to improve a service score.",
};

const DIMENSIONS = [
  {
    name: "Branch governance",
    measures: "Required reviewers · branch protection · linear history enforcement · signed commits",
    improve: "Enable required reviewers + branch protection on default branch. Set minimum 1 approver from CODEOWNERS.",
  },
  {
    name: "Rollback readiness",
    measures: "Existence of verified rollback path · measured RTO · pre-flight snapshot strategy",
    improve: "Add rollback rehearsals to your deployment workflow. Capture pre-flight snapshots for stateful resources.",
  },
  {
    name: "Observability",
    measures: "SLO/SLI definitions · alerting configured · structured logging · trace correlation",
    improve: "Define an SLO per service. Wire alerts on error rate and latency. Use a single tracing library.",
  },
  {
    name: "Deployment maturity",
    measures: "Phased rollouts · canary or blue/green present · feature flags · automated health checks between phases",
    improve: "Move from big-bang deploys to canary. Adopt feature flags for risky changes. Add health gates between phases.",
  },
  {
    name: "Operational coordination",
    measures: "Clear ownership · runbooks current · cross-team approval paths defined · escalation paths armed",
    improve: "Assign a single service owner. Keep runbooks within 30 days fresh. Document who approves what.",
  },
  {
    name: "Release auditability",
    measures: "Immutable trail of approvals + deploys · SOC 2/ISO control mapping · 100% deploy event capture",
    improve: "Ensure every deploy emits to Axiom's audit log. Map controls to your compliance framework.",
  },
  {
    name: "Terraform governance",
    measures: "Plan-gated CI · drift scans · rollback path per module · no destroy-creates without approval",
    improve: "Add terraform plan to every PR. Schedule drift scans every 6h. Add rollback Terraform per module.",
  },
  {
    name: "Infrastructure drift",
    measures: "Out-of-band changes detected and triaged within target window (default 12h)",
    improve: "Enable continuous drift monitoring. Triage drift events within SLA. Auto-correct low-risk drift.",
  },
  {
    name: "Release communication",
    measures: "Auto-generated release notes · stakeholder updates · status page sync · post-deploy comms",
    improve: "Wire release notes generation to the deploy pipeline. Auto-update status page. Notify stakeholders on production deploys.",
  },
];

export default function ReadinessScoringPage() {
  return (
    <>
      <DocHeader
        kicker="ReleaseOps · Readiness"
        title="Release readiness scoring."
        summary="A composite 0–100 score per service across 9 operational dimensions. Trackable over time, drill-downable to remediation, and used by the governance gate to block deploys below threshold."
      />

      <Callout variant="info" title="What the composite score means">
        The composite is the average of 9 dimension scores. A service at 80 has solid operational maturity. Below 75 typically gets gated for production deploys. Below 60 indicates the service needs a release readiness investment before more changes are safe.
      </Callout>

      <DocSection id="how-it-works" title="How scoring works" kicker="01">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Each dimension is scored 0.0 – 1.0 based on connector-ingested signals</li>
          <li>Signals are deterministic where possible (branch protection on/off) and quantitative where applicable (rollback RTO in seconds)</li>
          <li>The composite is the equal-weighted average across all 9 dimensions</li>
          <li>Scores recalibrate after every deploy event (real-time) and every connector sync (incremental)</li>
          <li>Trend is computed over a 30-day rolling window</li>
        </ul>
      </DocSection>

      <DocSection id="dimensions" title="The 9 dimensions" kicker="02">
        <div className="space-y-3">
          {DIMENSIONS.map((d) => (
            <div key={d.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-sm font-bold text-white mb-1.5">{d.name}</p>
              <div className="grid md:grid-cols-2 gap-3 mt-2">
                <div>
                  <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Measures</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{d.measures}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-widest mb-1">How to improve</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{d.improve}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="thresholds" title="Threshold semantics" kicker="03">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>85–100</strong> — Service is mature. Auto-apply low-risk changes is safe. Trust ladder can advance for this service.</li>
          <li><strong>75–84</strong> — Service is healthy. Production deploys proceed normally with standard approval.</li>
          <li><strong>60–74</strong> — Watch list. Approval gates may require additional reviewers. Investigate dimensions below 0.7.</li>
          <li><strong>Below 60</strong> — Production deploys blocked at the governance gate. Service needs a readiness investment.</li>
        </ul>
        <p>Thresholds are configurable per organization and per environment.</p>
      </DocSection>

      <DocSection id="improvement" title="Improving a score" kicker="04 · Remediation">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Open the service in <Link href="/dashboard/releaseops" className="text-violet-300 hover:text-violet-200">/dashboard/releaseops</Link></li>
          <li>Find the dimensions scoring below 0.7</li>
          <li>Each dimension links to a specific remediation playbook</li>
          <li>After remediation, the next deploy event refreshes the score</li>
          <li>Trend arrows on the service card show whether improvements are landing</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is a readiness score?", answer: "A composite 0–100 measure of how operationally mature a service is to release safely." },
            { question: "Why is this needed?", answer: "Senior engineers carry maturity models in their heads. ReleaseOps externalizes the model so new squads can ship safely too." },
            { question: "Is the score safe to act on?", answer: "Yes — each dimension is deterministic where possible. No subjective judgment in the score itself." },
            { question: "What gets blocked at low score?", answer: "Production deploys below configured threshold. Configurable per org and environment." },
            { question: "How do I improve a score?", answer: "Each low-scoring dimension links to a remediation playbook. Improvements typically land within 1–2 deploys." },
            { question: "What if scoring is wrong?", answer: "Score signals are auditable in /dashboard/releaseops. Open the service drilldown to see exactly which signals drove each dimension." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/releaseops/connectors", label: "CI/CD connectors" }}
        next={{ href: "/docs/desktop-install", label: "Install the desktop app" }}
      />
      <DocFeedback />
    </>
  );
}
