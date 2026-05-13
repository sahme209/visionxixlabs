import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Architecture overview — Axiom Documentation",
  description: "How Axiom Agent is built: web platform, desktop ecosystem, provider adapters, reasoning engine, execution orchestration, governance, audit, operational memory, and ReleaseOps.",
};

const LAYERS = [
  {
    n: "01",
    name: "Provider adapter layer",
    desc: "Read-only connectors for AWS (live), Azure (scan + topology live, reasoning Q2 2026), GCP (scan + topology live, reasoning Q3 2026). Each adapter normalizes provider-specific responses into a typed snapshot.",
    color: "amber",
  },
  {
    n: "02",
    name: "Cloud snapshot layer",
    desc: "Typed resource graph per scan — compute, storage, network, identity, observability — with provider tags and region scoping. Snapshots persist immutably and feed every downstream layer.",
    color: "blue",
  },
  {
    n: "03",
    name: "Signal engine",
    desc: "Pure functions over snapshots that produce findings: cost waste, security exposure, drift, performance, compliance gaps. Each signal is deterministic, testable, and traceable.",
    color: "violet",
  },
  {
    n: "04",
    name: "Reasoning layer",
    desc: "12-step cognitive loop (observe → interpret → reason → plan → verify → execute) that turns findings into prioritized, dependency-aware recommendations. Every step is auditable.",
    color: "violet",
  },
  {
    n: "05",
    name: "Execution planning",
    desc: "Phased Terraform / CLI generation with blast-radius classification, pre-flight snapshot capture, measured rollback RTO, and safety check pre-conditions per item.",
    color: "fuchsia",
  },
  {
    n: "06",
    name: "Approval + governance",
    desc: "Multi-tier approval gates (low / medium / high risk). Trust Ladder model for measured autonomy escalation per action class. Cannot self-escalate.",
    color: "amber",
  },
  {
    n: "07",
    name: "Audit fabric",
    desc: "Immutable AxiomAuditEvent ledger for every action — provider mutations, approvals, rollbacks, user operations. SOC 2 / ISO 27001 control mapping built in.",
    color: "emerald",
  },
  {
    n: "08",
    name: "Monitoring + drift",
    desc: "Continuous detection of out-of-band changes. Recurring workflows for cost anomaly watch, compliance sweep, post-execution verification, and rollback orchestration standby.",
    color: "cyan",
  },
  {
    n: "09",
    name: "Operational memory",
    desc: "90-day persistent history of scans, recommendations, executions, approvals, outcomes. Per-service confidence calibration. Powers the agent's recalibration over time.",
    color: "violet",
  },
  {
    n: "10",
    name: "ReleaseOps layer",
    desc: "Deployment intelligence + governance above CI/CD systems (GitHub, GitLab, Azure DevOps, Jenkins, ArgoCD, ServiceNow). Shares topology, memory, reasoning, audit with cloud ops.",
    color: "fuchsia",
  },
];

const COLOR_MAP = {
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  fuchsia: "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
} as const;

export default function ArchitecturePage() {
  return (
    <>
      <DocHeader
        kicker="Start here · Architecture"
        title="Architecture overview."
        summary="A 10-layer architecture: provider adapters, cloud snapshots, signal engine, reasoning, execution planning, approval/governance, audit, monitoring/drift, operational memory, ReleaseOps. Web today, desktop preview, multi-cloud expanding."
      />

      <Callout variant="info" title="Read this if">
        You&apos;re evaluating Axiom for enterprise deployment, considering acquiring or building integrations, or need to explain Axiom internally to security/IT/compliance.
      </Callout>

      <DocSection id="form" title="The platform form factor" kicker="01 · Form factor">
        <p>Axiom runs as two surfaces that share the same operational data:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Web platform</strong> — available today. Browser-based operational command center, full feature set across cloud ops + ReleaseOps + topology + memory + workflows + approvals.</li>
          <li><strong>Desktop application</strong> — macOS preview today. Windows Q2 2026. Linux Q3 2026. Adds local Terraform execution, OS keychain credential storage, native notifications, workstation mode (no outbound network).</li>
          <li><strong>CLI binary</strong> — available now via brew/scoop/npm. Headless scans, plans, approvals, applies for CI/CD pipelines.</li>
        </ul>
        <p>All three share the same operational memory and audit fabric.</p>
      </DocSection>

      <DocSection id="layers" title="The 10 architectural layers" kicker="02 · Layers">
        <p>From bottom (cloud APIs) to top (release coordination):</p>
        <ol className="space-y-3 mt-4">
          {LAYERS.map((l) => (
            <li key={l.n} className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl border ${COLOR_MAP[l.color as keyof typeof COLOR_MAP]} flex items-center justify-center font-mono font-bold text-sm shrink-0`}>
                {l.n}
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">{l.name}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{l.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </DocSection>

      <DocSection id="data-flow" title="How data flows" kicker="03 · Data flow">
        <p>A typical scan-to-execute lifecycle traces all 10 layers:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Connector adapter (01) assumes IAM role, enumerates resources, normalizes responses</li>
          <li>Snapshot (02) persists the typed resource graph</li>
          <li>Signal engine (03) produces deterministic findings</li>
          <li>Reasoning (04) prioritizes findings + builds recommendations</li>
          <li>Execution planner (05) generates phased Terraform with rollback paths</li>
          <li>Approval gate (06) routes to the right approver tier</li>
          <li>Apply happens — audit fabric (07) records every step</li>
          <li>Monitoring (08) verifies the outcome and watches for drift</li>
          <li>Memory (09) records the outcome for future confidence calibration</li>
          <li>ReleaseOps (10) overlays release events onto this same operational graph</li>
        </ol>
      </DocSection>

      <DocSection id="tenancy" title="Multi-tenant isolation" kicker="04">
        <p>Multi-tenant on shared infrastructure, isolated at every layer:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Database rows are scoped to <code>organizationId</code>; queries always filter through tenant scope</li>
          <li>Operational memory is per-org; confidence in one org never influences another</li>
          <li>Per-connection External IDs prevent cross-tenant role assumption</li>
          <li>Audit log export is org-scoped at the API layer</li>
        </ul>
        <p>See <Link href="/docs/security-model" className="text-violet-300 hover:text-violet-200">security model</Link> for the full isolation breakdown.</p>
      </DocSection>

      <DocSection id="deployment" title="Deployment patterns" kicker="05">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>SaaS multi-tenant</strong> — default; available on all tiers</li>
          <li><strong>Single-tenant SaaS</strong> — Enterprise tier; dedicated database, dedicated reasoning quotas</li>
          <li><strong>Customer-hosted control plane</strong> — Enterprise tier; deploys via Helm/Terraform into your own cloud; all data stays in your VPC</li>
          <li><strong>Air-gapped workstation</strong> — Desktop Enterprise tier; local reasoning model + workstation mode; no outbound network whatsoever</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is this architecture optimized for?", answer: "Auditable autonomy — the system can act, but every step is observable, reversible, and policy-bounded." },
            { question: "Why 10 layers?", answer: "Each layer is independently auditable and replaceable. Signal engine can be tuned without touching reasoning. Reasoning can evolve without affecting audit." },
            { question: "Is the data flow safe?", answer: "Yes — read-only at provider layer; reasoning runs server-side in your tenant; execution requires approval; audit captures everything." },
            { question: "What does Axiom store across layers?", answer: "Snapshots, findings, plans, audit events. Never credentials, never object contents, never secret material." },
            { question: "What if I need air-gapped?", answer: "Desktop Enterprise tier with workstation mode + local reasoning model. No outbound network beyond direct AWS API." },
            { question: "How do I integrate?", answer: "REST API for read paths (operational memory, audit export, readiness scores). Webhook delivery for events. Connector framework for new providers." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/getting-started", label: "Getting started" }}
        next={{ href: "/docs/aws-setup", label: "AWS setup" }}
      />
      <DocFeedback />
    </>
  );
}
