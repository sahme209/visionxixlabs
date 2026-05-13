import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "GCP setup — Axiom Documentation",
  description: "How Axiom connects to Google Cloud today (Service Account + scan), and what's rolling out in Q3 2026 (reasoning + execution).",
};

export default function GcpSetupPage() {
  return (
    <>
      <DocHeader
        kicker="Connect a cloud · GCP · Expanding"
        title="GCP setup."
        summary="Axiom's GCP connector is live for scan + topology mapping. Reasoning + execution roll out in Q3 2026. This page documents what works today and what's coming honestly."
      />

      <Callout variant="warning" title="Honest state — GCP is expanding">
        <strong>Live today:</strong> Service Account onboarding, project enumeration, Compute Engine + Cloud Storage + Networking + IAM scanning, topology mapping, basic drift detection.
        <br /><br />
        <strong>Q3 2026:</strong> Full reasoning loop, execution plans, Terraform export, approval workflow, rollback orchestration — parity with AWS.
        <br /><br />
        Subscribe at <Link href="/contact?topic=gcp-preview">/contact</Link> for early-access invitations.
      </Callout>

      <DocSection id="live-today" title="What works today" kicker="01">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Service Account onboarding</strong> — workload identity federation preferred; JSON key supported as fallback</li>
          <li><strong>Project + folder scanning</strong> — scoped by your IAM bindings</li>
          <li><strong>Compute Engine</strong> — instances, instance groups, machine types, disks, network interfaces</li>
          <li><strong>Cloud Storage</strong> — buckets, lifecycle rules, encryption settings, public access prevention</li>
          <li><strong>Networking</strong> — VPCs, subnets, firewall rules, Cloud NAT, load balancers</li>
          <li><strong>IAM</strong> — bindings, custom roles, service accounts inventory</li>
          <li><strong>Topology mapping</strong> — GCP resources appear in <Link href="/dashboard/topology" className="text-violet-300 hover:text-violet-200">/dashboard/topology</Link></li>
          <li><strong>Basic drift detection</strong> — flagged in the activity feed</li>
        </ul>
      </DocSection>

      <DocSection id="onboarding" title="Onboarding (preview path)" kicker="02">
        <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Create a Service Account in the project (or folder) you want to scan</li>
          <li>Grant <code>roles/viewer</code> + <code>roles/iam.securityReviewer</code> at the chosen scope</li>
          <li>Add a custom role for Cloud Billing read access (we provide the exact role definition)</li>
          <li>Configure workload identity federation with Axiom as the trusted issuer (no JSON key shared)</li>
          <li>Paste the Project ID + Service Account email into the Axiom onboarding wizard</li>
        </ol>
        <p>If your org disallows workload identity federation, JSON key upload is supported — but expires and rotates every 30 days automatically.</p>
      </DocSection>

      <DocSection id="permissions" title="Expected permissions" kicker="03 · Permissions">
        <p>Scan role (today):</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li><code>roles/viewer</code> — broad read across Compute, Storage, Networking</li>
          <li><code>roles/iam.securityReviewer</code> — IAM analysis read</li>
          <li>Custom role for Cloud Billing read (we provide it)</li>
          <li>Custom role for Cloud Audit Log read (we provide it)</li>
        </ul>
        <p>Execution role (Q3 2026):</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Separate custom roles with minimum-scope write permissions per action class</li>
          <li>Approval-gated assumption — same model as AWS</li>
        </ul>
      </DocSection>

      <DocSection id="roadmap" title="Q3 2026 roadmap" kicker="04 · Roadmap">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>July 2026</strong> — Signal engine for GCP (cost waste, security, drift, performance)</li>
          <li><strong>August 2026</strong> — Reasoning loop adapted for GCP resource model</li>
          <li><strong>September 2026</strong> — Execution planning + Terraform generation for GCP</li>
          <li><strong>Late Q3 2026</strong> — Approval workflow + rollback orchestration parity with AWS</li>
        </ul>
      </DocSection>

      <DocSection id="security" title="Security model" kicker="05">
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Workload identity federation preferred — no JSON key stored long-term</li>
          <li>Read-only by default</li>
          <li>Project/folder scoping enforced at the IAM binding level</li>
          <li>Revocable instantly by removing the IAM binding or disabling the Service Account</li>
          <li>All API calls captured in Cloud Audit Logs on your side</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "Is GCP fully live?", answer: "Scan + topology + basic drift are live today. Reasoning + execution + approval ship Q3 2026." },
            { question: "Why connect now?", answer: "Topology + drift are immediately useful for multi-cloud orgs. You'll be ready when reasoning ships." },
            { question: "Is the GCP connection safe?", answer: "Yes — read-only at the project/folder scope you choose. Workload identity federation over JSON keys where possible." },
            { question: "What does Axiom store?", answer: "Resource metadata + topology graph. Never bucket contents, never database row data, never secrets." },
            { question: "Can I revoke?", answer: "Yes — remove the IAM binding or disable the Service Account. Axiom loses access immediately." },
            { question: "How do I get early access to Q3?", answer: "Subscribe at /contact?topic=gcp-preview. We invite teams in waves as each capability ships." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/azure-setup", label: "Azure setup" }}
        next={{ href: "/docs/scanning", label: "Infrastructure scanning" }}
      />
      <DocFeedback />
    </>
  );
}
