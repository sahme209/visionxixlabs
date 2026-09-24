import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "FAQ — Axiom Documentation",
  description: "Frequently asked questions about Axiom Agent — cloud connections, scanning, execution, approvals, ReleaseOps, desktop, pricing, and security.",
};

const FAQ_GROUPS = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Axiom Agent?",
        a: "A downloadable deployment-operations workspace for intake, readiness, approvals, plan review, guided execution, validation, evidence, and closure. Connector and execution availability is shown in the installed release.",
      },
      {
        q: "How is this different from a regular cloud cost tool?",
        a: "Cost tools alert. Axiom operates. It doesn't just list findings — it generates phased execution plans with Terraform code, runs the change behind your approval, verifies the outcome, and learns from the result. The same engine handles security, drift, and resilience.",
      },
      {
        q: "Does Axiom replace my existing tooling?",
        a: "No. Axiom runs above CloudWatch, AWS Config, Terraform, GitHub Actions, ServiceNow, etc. It coordinates and analyzes them — it does not replace any of them.",
      },
    ],
  },
  {
    title: "Cloud connections",
    items: [
      {
        q: "What clouds are supported?",
        a: "AWS is fully implemented (scan, reason, plan, execute, monitor, learn). Azure and GCP have working connectors with scan + topology mapping; the reasoning and execution layers are rolling out in Q2 and Q3 2026.",
      },
      {
        q: "What permissions does Axiom need?",
        a: "Read-only by default — Describe, Get, List actions only. Execution requires a separate, more-scoped role you opt into per action class. Full details at /docs/aws-setup.",
      },
      {
        q: "Are credentials stored?",
        a: "Never. Axiom uses assume-role with External ID. Temporary credentials live in memory for the scan and are discarded immediately after. We don't see access keys.",
      },
      {
        q: "How do I revoke access?",
        a: "Delete the IAM role in your AWS console. Axiom immediately loses all access. Optionally also disconnect from the Axiom dashboard.",
      },
    ],
  },
  {
    title: "Scanning & operations",
    items: [
      {
        q: "How long does a scan take?",
        a: "First scan on a typical mid-size account: 60–180 seconds. Initial scans on accounts with 1000+ resources can take 10–15 minutes. Subsequent scans are incremental and usually complete in under 2 minutes.",
      },
      {
        q: "Can scans run on a schedule?",
        a: "Yes — daily, hourly, or custom. Recurring scans live under /dashboard/workflows. Each scan feeds the operational memory.",
      },
      {
        q: "What does the agent learn over time?",
        a: "Outcome of every action — which action types succeed on which resources. After repeated failures on a class of action, the agent auto-downgrades that class from auto-fix to human-review. Confidence calibrates per service, per change type, per team.",
      },
      {
        q: "Can I see why a recommendation was made?",
        a: "Yes. Every recommendation includes a reasoning trace — observe → interpret → reason → plan → verify — with per-step evidence and confidence. See it in the Command Center or directly on the run page.",
      },
    ],
  },
  {
    title: "Execution & approval",
    items: [
      {
        q: "Does Axiom apply changes automatically?",
        a: "Never by default. Every execution requires explicit approval. Multi-party approval kicks in for broad blast-radius changes. The agent cannot grant itself more autonomy.",
      },
      {
        q: "What if an execution fails?",
        a: "Rollback availability depends on the active adapter, prerequisites, and verified recovery evidence. When automatic rollback is unavailable, the app must keep the failure visible and require an explicit manual recovery path.",
      },
      {
        q: "Can I export the Terraform plan instead of applying?",
        a: "Yes. Every execution plan generates Terraform you can download, review locally, and apply through your own pipeline. Axiom doesn't have to execute — it can be the intelligence layer above your existing IaC flow.",
      },
    ],
  },
  {
    title: "ReleaseOps",
    items: [
      {
        q: "What does Axiom ReleaseOps integrate with?",
        a: "GitHub Actions, GitLab CI, Azure DevOps, Jenkins, ArgoCD, and ServiceNow on the workflow side. Terraform Cloud / Enterprise on the IaC side. AWS/Azure/GCP on the infrastructure side.",
      },
      {
        q: "Does ReleaseOps run deployments itself?",
        a: "By default no — it observes and scores. Once governance is configured, ReleaseOps can orchestrate approval-gated deployments through your existing pipelines without bypassing them.",
      },
      {
        q: "What is a Release Readiness score?",
        a: "A composite 0–100 score across 9 operational dimensions: branch governance, rollback readiness, observability, deployment maturity, operational coordination, audit completeness, Terraform governance, drift detection, release communication. Trackable per service over time.",
      },
    ],
  },
  {
    title: "Desktop",
    items: [
      {
        q: "Is there a desktop app?",
        a: "macOS preview is available now. Windows is rolling out in Q2 2026, Linux in Q3 2026. The web platform is available on all browsers immediately.",
      },
      {
        q: "What does the desktop app do that the web doesn't?",
        a: "Local Terraform execution, OS keychain credential storage, secure workstation mode, background scanning with native notifications, and offline audit log export. The same dashboards as web — but the data never leaves your machine.",
      },
      {
        q: "Where do I download?",
        a: "Visit /download for OS-detected install links and the full platform roadmap.",
      },
    ],
  },
  {
    title: "Pricing & access",
    items: [
      {
        q: "How is Axiom priced?",
        a: "Pricing is quote-based and tied to the installed application, verified capabilities, connector scope, usage limits, and support terms. The public site does not promise an unverified free tier.",
      },
      {
        q: "Can I review the product before requesting a quote?",
        a: "Yes. Use the labeled sample-data sandbox, read the documentation, and download the current release. Connecting real systems requires appropriate accounts and permissions.",
      },
      {
        q: "Which identity options are available?",
        a: "Desktop sign-in uses the identity providers configured on the deployment. Confirm SAML, OIDC, SCIM, and provider availability in the written implementation scope rather than inferring it from a logo.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <DocHeader
        kicker="Reference · FAQ"
        title="Frequently asked questions."
        summary="The questions we see most often, grouped by topic. If something isn't answered here, the troubleshooting guide or product documentation usually has the answer."
      />

      {FAQ_GROUPS.map((group) => (
        <DocSection key={group.title} id={group.title.toLowerCase().replace(/\s+/g, "-")} title={group.title}>
          <div className="space-y-3">
            {group.items.map((item) => (
              <details key={item.q} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 group">
                <summary className="cursor-pointer flex items-center justify-between gap-3 text-sm font-semibold text-white hover:text-violet-300 transition-colors list-none">
                  <span>{item.q}</span>
                  <svg className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p className="text-sm text-zinc-400 leading-relaxed mt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </DocSection>
      ))}

      <DocSection id="more" title="More questions?">
        <p className="text-zinc-400">
          See <Link href="/docs/troubleshooting" className="text-violet-300 hover:text-violet-200">troubleshooting</Link> for specific errors,
          or <Link href="/contact" className="text-violet-300 hover:text-violet-200">contact us</Link> for anything else.
        </p>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/troubleshooting", label: "Troubleshooting" }}
        next={{ href: "/docs/glossary", label: "Glossary" }}
      />
      <DocFeedback />
    </>
  );
}
