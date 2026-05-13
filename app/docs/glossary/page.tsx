import type { Metadata } from "next";
import { DocHeader, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Glossary — Axiom Documentation",
  description: "Definitions for terms used throughout Axiom Agent — operational, AI, cloud, and ReleaseOps vocabulary.",
};

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Agent Run", def: "A single end-to-end pass of the 12-step reasoning loop — observe, interpret, reason, plan, verify, execute. Each run produces findings, recommendations, and an execution plan." },
  { term: "Approval Gate", def: "A policy enforcement point that requires explicit human approval before an execution plan item can be applied. Multi-party approval triggers for broad blast-radius changes." },
  { term: "Assume-Role", def: "AWS's credential model where Axiom calls sts:AssumeRole in your account to receive temporary 1-hour credentials. Axiom never holds long-lived access keys." },
  { term: "Audit Event", def: "An immutable record of every cloud mutation — actor, resource, before-state, after-state, status. Powers SOC 2 / ISO 27001 audit evidence." },
  { term: "Blast Radius", def: "Quantitative classification of how many resources a change affects. Classifications: contained (1–5 resources), moderate (6–20), broad (20+). Approval rules cascade." },
  { term: "Composite Readiness Score", def: "A 0–100 score per service in ReleaseOps, computed from 9 operational dimensions. Below threshold (default 75) blocks releases at the governance gate." },
  { term: "Confidence Calibration", def: "The agent's self-assessment of how reliable its reasoning is for a given action class. Outcome of every executed action feeds back into confidence per-class, per-service." },
  { term: "Connector", def: "An integration adapter for a specific external system (AWS, Azure, GCP, GitHub, GitLab, Jenkins, ServiceNow). Connectors are read-only by default and never store credentials." },
  { term: "Drift", def: "Configuration that has diverged from its declared/desired state. Axiom detects drift continuously and can either alert, auto-correct (with approval), or block downstream releases until resolved." },
  { term: "Execution Plan", def: "A phased, dependency-aware sequence of changes Axiom proposes after a scan. Each item includes Terraform, blast radius, pre-verified rollback, and approval requirements." },
  { term: "External ID", def: "A unique secret per Axiom connection used in the AWS trust policy condition. Prevents confused-deputy attacks across tenants." },
  { term: "Finding", def: "A discrete issue detected during a scan — categorized (cost, security, drift, performance, compliance) and severity-scored (info, low, medium, high, critical)." },
  { term: "Operational Memory", def: "Persistent 90-day history of scans, recommendations, executions, approvals, and outcomes. Powers the agent's per-service confidence calibration." },
  { term: "Plan Item", def: "An atomic unit within an execution plan — typically one resource modification with its own approval, rollback, and verification." },
  { term: "Pre-Flight Snapshot", def: "A state capture taken immediately before any execution begins. Used to construct the verified rollback path." },
  { term: "Reasoning Trace", def: "The auditable per-step record of how the agent reached a recommendation — observe → interpret → reason → plan → verify — with evidence and confidence per step." },
  { term: "Recommendation", def: "A specific suggested action attached to one or more findings. Includes rationale, risk level, monthly impact, and approval requirements." },
  { term: "Recurring Analysis", def: "A scheduled workflow that runs at a configured cadence (hourly, daily, weekly). Produces an Agent Run each cycle." },
  { term: "Rollback RTO", def: "Recovery Time Objective — the measured time required to restore prior state if an execution fails. Pre-verified before approval." },
  { term: "Service Principal", def: "Azure's analog of an IAM role — Axiom's recommended Azure onboarding model." },
  { term: "Service Account", def: "GCP's analog of an IAM role — Axiom's recommended GCP onboarding model." },
  { term: "Trust Ladder", def: "The governance model that lets agent autonomy escalate per action class only after a configured run of successful outcomes. The agent cannot self-escalate." },
];

export default function GlossaryPage() {
  return (
    <>
      <DocHeader
        kicker="Reference · Glossary"
        title="Glossary."
        summary="Definitions for vocabulary used across the Axiom platform — operational, AI, cloud, and ReleaseOps terms."
      />

      <dl className="grid sm:grid-cols-2 gap-3">
        {GLOSSARY.map((entry) => (
          <div key={entry.term} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <dt className="text-sm font-bold text-white mb-1">{entry.term}</dt>
            <dd className="text-xs text-zinc-400 leading-relaxed">{entry.def}</dd>
          </div>
        ))}
      </dl>

      <DocFooterNav
        prev={{ href: "/docs/faq", label: "FAQ" }}
      />
      <DocFeedback />
    </>
  );
}
