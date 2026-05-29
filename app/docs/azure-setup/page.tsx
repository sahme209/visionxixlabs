import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Azure setup — Axiom Documentation",
  description: "How Axiom connects to Azure today (Service Principal + scan), and what's rolling out in Q2 2026 (reasoning + execution).",
};

export default function AzureSetupPage() {
  return (
    <>
      <DocHeader
        kicker="Connect a cloud · Azure · Expanding"
        title="Azure setup."
        summary="Axiom's Azure connector is live for scan + topology mapping. Reasoning + execution roll out in Q2 2026. This page documents what works today and what's coming honestly."
      />

      <Callout variant="warning" title="Honest state — Azure is expanding">
        <strong>Live today:</strong> Service Principal onboarding, subscription enumeration, VM + Storage + Network + IAM scanning, topology mapping, drift detection (basic).
        <br /><br />
        <strong>Q2 2026:</strong> Full 12-step reasoning loop, execution plans, Terraform export, approval workflow, rollback orchestration — the same surface AWS has today.
        <br /><br />
        Subscribe at <Link href="/contact?topic=azure-preview">/contact</Link> for the early-access invitation.
      </Callout>

      <DocSection id="live-today" title="What works today" kicker="01">
        <p>The Azure connector covers:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Service Principal onboarding</strong> — federated identity (workload identity federation) preferred; client secret supported as fallback</li>
          <li><strong>Subscription + resource-group scanning</strong> — scoped by your role assignment</li>
          <li><strong>Virtual Machines</strong> — VM size, OS, disk attachments, NIC config, availability sets</li>
          <li><strong>Storage Accounts</strong> — blob containers, tier, encryption settings, network rules</li>
          <li><strong>Networking</strong> — VNets, subnets, NSGs, NSG rules, public IPs, load balancers</li>
          <li><strong>IAM</strong> — role assignments, custom roles, Azure AD identities used for RBAC</li>
          <li><strong>Topology mapping</strong> — Azure resources appear in <Link href="/dashboard/topology" className="text-violet-300 hover:text-violet-200">/dashboard/topology</Link> alongside AWS/GCP</li>
          <li><strong>Basic drift detection</strong> — out-of-band changes flagged in the activity feed</li>
        </ul>
      </DocSection>

      <DocSection id="onboarding" title="Onboarding (preview path)" kicker="02 · Onboarding">
        <p>Onboarding is preview-only — the wizard exists; reasoning + execution arrive later. Today you can:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Register an Application in your Azure AD tenant</li>
          <li>Create a Service Principal for that Application</li>
          <li>Assign the <code>Reader</code> built-in role at subscription or resource-group scope</li>
          <li>Configure federated identity credentials pointing at Axiom&apos;s issuer (no client secret to share)</li>
          <li>Paste the Tenant ID + Subscription ID + Application ID into the Axiom onboarding wizard</li>
        </ol>
        <p>Sign in, then see the <Link href="/dashboard/connect-cloud" className="text-violet-300 hover:text-violet-200">in-dashboard connect flow</Link> for the exact values to copy.</p>
      </DocSection>

      <DocSection id="permissions" title="Expected permissions" kicker="03 · Permissions">
        <p>Scan role (today):</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li><code>Reader</code> built-in role at subscription scope (or resource-group scope for tighter isolation)</li>
          <li>Custom role for Cost Management read access (we provide the exact role definition during onboarding)</li>
        </ul>
        <p>Execution role (Q2 2026):</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Separate custom role with the smallest possible Modify/Delete actions per opt-in action class</li>
          <li>Approval-gated assumption — same model as AWS</li>
        </ul>
        <p>Full permissions model at <Link href="/docs/permissions-model" className="text-violet-300 hover:text-violet-200">/docs/permissions-model</Link>.</p>
      </DocSection>

      <DocSection id="roadmap" title="Q2 2026 roadmap" kicker="04 · Roadmap">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>April 2026</strong> — Signal engine for Azure (cost waste, security exposure, drift signals)</li>
          <li><strong>May 2026</strong> — Reasoning loop adapted for Azure resource model</li>
          <li><strong>June 2026</strong> — Execution planning + Bicep / Terraform generation for Azure</li>
          <li><strong>Late Q2 2026</strong> — Approval workflow + rollback orchestration parity with AWS</li>
        </ul>
        <p>Roadmap visible at <Link href="/dashboard/workflows" className="text-violet-300 hover:text-violet-200">/dashboard/workflows</Link> as the reasoning loop ships.</p>
      </DocSection>

      <DocSection id="security" title="Security model" kicker="05">
        <p>Same constraints as AWS:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Federated identity preferred — no client secret stored on Axiom&apos;s side</li>
          <li>Read-only by default</li>
          <li>Subscription/resource-group scoping enforced at the role assignment level</li>
          <li>Revocable instantly by removing the role assignment or disabling the Service Principal</li>
          <li>All assume / scan events captured in Azure Activity Log on your side</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "Is Azure fully live?", answer: "Scan + topology + basic drift are live today. Reasoning + execution + approval ship Q2 2026." },
            { question: "Why connect now if reasoning isn't live?", answer: "Topology mapping + drift detection are immediately useful for multi-cloud teams. You'll be ready when reasoning ships." },
            { question: "Is the Azure connection safe?", answer: "Yes — read-only Reader role at the scope you choose. Federated identity over client secrets where possible." },
            { question: "What does Axiom store?", answer: "Resource metadata and topology graph. Never blob contents, never database row data, never secrets." },
            { question: "Can I revoke?", answer: "Yes — remove the role assignment or disable the Service Principal. Axiom loses access immediately." },
            { question: "How do I get early access to Q2 features?", answer: "Subscribe at /contact?topic=azure-preview. We invite teams in waves as each capability ships." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/aws-setup", label: "AWS setup" }}
        next={{ href: "/docs/gcp-setup", label: "GCP setup" }}
      />
      <DocFeedback />
    </>
  );
}
