import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "CI/CD connectors — ReleaseOps Documentation",
  description: "Connect GitHub, GitLab, Azure DevOps, Jenkins, ArgoCD, and ServiceNow to ReleaseOps. What each connector reads and what it does not.",
};

const CONNECTORS = [
  {
    name: "GitHub",
    auth: "GitHub App installation (org-level)",
    reads: ["Branch protection rules", "Required reviewers", "Workflow runs + deployment events", "Pull requests + reviews", "Release tags + notes", "Repository configuration"],
    notReads: ["Source code contents (Axiom never clones repos)", "Issue contents", "GitHub Secrets values", "Private user data"],
    notes: "Org admin must approve the App installation if your org has restrictions. Webhook delivery is real-time.",
  },
  {
    name: "GitLab",
    auth: "Project or Group access token (scoped: api, read_repository)",
    reads: ["CI/CD pipelines + jobs", "Merge request reviews", "Protected branches", "Deployment history", "Project settings"],
    notReads: ["File contents in repos", "Issue contents", "CI/CD variables values", "Personal user tokens"],
    notes: "Self-hosted GitLab is supported via custom base URL. Token rotation supported via Settings → Connections.",
  },
  {
    name: "Azure DevOps",
    auth: "Service Connection (Personal Access Token, scopes: Code-Read, Build-Read, Release-Read)",
    reads: ["Build pipelines + runs", "Release pipelines + deployments", "Branch policies", "Pull request approvals", "Service connections (metadata)"],
    notReads: ["Source code", "Pipeline variables (secret-marked)", "Work item details"],
    notes: "Personal Access Tokens expire — Axiom warns 14 days before expiration and prompts for rotation.",
  },
  {
    name: "Jenkins",
    auth: "API token + Crumb (per Jenkins user with appropriate read permissions)",
    reads: ["Job/pipeline metadata", "Build history + statuses", "Pipeline definitions (Jenkinsfile metadata)", "Build artifacts metadata (not contents)"],
    notReads: ["Build artifact contents", "Credentials store", "Jenkins user passwords"],
    notes: "Network reachability required — Axiom polls Jenkins APIs. Self-hosted with reverse proxy supported via outbound webhook.",
  },
  {
    name: "ArgoCD",
    auth: "ArgoCD project token (scope: applications, get)",
    reads: ["Application sync state", "Deployment history", "Health status", "Project + cluster configuration"],
    notReads: ["Manifest contents beyond app metadata", "Cluster credentials"],
    notes: "Each Application sync registers as a release event. Sync failures surface in the activity feed.",
  },
  {
    name: "ServiceNow",
    auth: "OAuth 2.0 application + service account (scopes: change_request:read, change_request:write)",
    reads: ["Change Request status + approvals", "CR fields relevant to release"],
    notReads: ["Other ServiceNow modules (Incident, Problem, CMDB) — opt-in separately"],
    notes: "Axiom can auto-create CRs with risk justification + rollback strategy attached, and auto-close on verification.",
  },
];

export default function ReleaseOpsConnectorsPage() {
  return (
    <>
      <DocHeader
        kicker="ReleaseOps · Connectors"
        title="CI/CD connectors."
        summary="What each ReleaseOps connector reads, what it doesn't, and how to authorize. Every connector is read-only by default; write access (orchestrating approvals, creating Change Requests) is opt-in per system."
      />

      <Callout variant="safe" title="The model">
        Every connector authenticates with the minimum scopes required to read release telemetry. Write operations are opt-in per connector and per action class. Tokens never leave Axiom; they&apos;re encrypted at rest and never logged.
      </Callout>

      {CONNECTORS.map((c) => (
        <DocSection key={c.name} id={c.name.toLowerCase().replace(/\s+/g, "-")} title={c.name}>
          <ul className="space-y-1.5 text-sm text-zinc-400">
            <li><strong className="text-zinc-300">Auth method:</strong> {c.auth}</li>
          </ul>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 p-4">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">What Axiom reads</p>
              <ul className="text-xs text-zinc-300 space-y-1">
                {c.reads.map((r) => <li key={r}>· {r}</li>)}
              </ul>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">What Axiom does NOT read</p>
              <ul className="text-xs text-zinc-400 space-y-1">
                {c.notReads.map((r) => <li key={r}>· {r}</li>)}
              </ul>
            </div>
          </div>
          <p className="text-xs text-zinc-500 italic mt-3">{c.notes}</p>
        </DocSection>
      ))}

      <DocSection id="rotation" title="Token rotation + revocation">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Rotate any token from <strong>Dashboard → Settings → Connections → [connector] → Rotate</strong></li>
          <li>Revoke instantly by deleting the token in the source system (GitHub, GitLab, etc.) — Axiom detects the auth failure on next sync and surfaces it</li>
          <li>Axiom proactively warns 14 days before any token expiration</li>
          <li>Self-hosted instances: revoke at the network layer by blocking egress to Axiom&apos;s service IPs</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What does each connector access?", answer: "Only release telemetry — pipelines, deployments, approvals, branch protection. Never source code or secret values." },
            { question: "Where are tokens stored?", answer: "Encrypted at rest with per-tenant keys. Never logged. Never transmitted to other tenants." },
            { question: "Is this safe for regulated environments?", answer: "Yes — read-only by default. Write scope is opt-in per connector. SOC 2 control mapping built in." },
            { question: "Can I revoke instantly?", answer: "Yes — delete the token in the source system or click Revoke in Axiom. Both work immediately." },
            { question: "What about self-hosted instances?", answer: "Supported for GitLab, Jenkins, Azure DevOps. ServiceNow self-hosted: contact us." },
            { question: "What if the connector fails to sync?", answer: "Sync failures surface in the connector panel of the ReleaseOps Command Center with the exact error and a fix link." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/releaseops", label: "ReleaseOps overview" }}
        next={{ href: "/docs/releaseops/readiness", label: "Readiness scoring" }}
      />
      <DocFeedback />
    </>
  );
}
