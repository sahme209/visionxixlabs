import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Permissions model — Axiom Documentation",
  description: "Why least-privilege matters, what Axiom can and cannot access by default, how execution permissions are separated from read permissions, and how to revoke.",
};

export default function PermissionsModelPage() {
  // The former page describes unverified cloud-execution behavior. Keep the
  // stable URL, but send visitors to the current, evidence-backed boundary.
  redirect("/docs/security-model");

  return (
    <>
      <DocHeader
        kicker="Trust & security · Permissions"
        title="The Axiom permissions model."
        summary="Read-only by default. Execution is a separate opt-in. No write permissions live in the scan role. Provider-specific permission shapes for AWS, Azure (preview), and GCP (preview). Revocable in one click."
      />

      <Callout variant="safe" title="The model in one sentence">
        Two roles exist, never one. The scan role is read-only and contains zero write permissions. The execution role is opt-in per action class, more-scoped than the scan role, and used only when Axiom applies a change.
      </Callout>

      <DocSection id="why" title="Why least privilege" kicker="01">
        <p>Most cloud incidents involving third-party tools trace to over-permissive integration roles:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Vendor compromise becomes customer compromise when the integration role has write access</li>
          <li>&quot;Just-in-case&quot; permissions accumulate and rarely get cleaned up</li>
          <li>Auditors can&apos;t reason about scope when the role grants <code>*</code> on broad services</li>
        </ul>
        <p>Axiom solves this by making the smallest possible role the default — and forcing every additional capability to be a deliberate opt-in.</p>
      </DocSection>

      <DocSection id="aws-scan-role" title="AWS scan role (read-only)" kicker="02 · AWS · Read">
        <p>The role Axiom creates during onboarding contains <strong>only</strong> Describe / Get / List actions across:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>EC2, S3, RDS, IAM, CloudWatch, CloudWatch Logs, Cost Explorer, STS, Resource Groups Tagging</li>
        </ul>
        <p>It cannot:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Create, modify, or delete any resource</li>
          <li>Read object content (S3) or row data (RDS)</li>
          <li>Decrypt secrets or KMS keys</li>
          <li>Read Lambda function source code or environment variable values</li>
          <li>Modify IAM policies, users, roles, or permission boundaries</li>
        </ul>
        <p>Full policy + per-line explanation at <Link href="/docs/aws-setup#permissions-explained" className="text-violet-300 hover:text-violet-200">/docs/aws-setup</Link>.</p>
      </DocSection>

      <DocSection id="aws-execution-role" title="AWS execution role (opt-in, separate)" kicker="03 · AWS · Execute">
        <p>Execution requires a <strong>second</strong> IAM role you create per action class. Three rules:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Per action class</strong> — separate execution roles for cost optimization, security remediation, drift correction, and ReleaseOps. You can enable only the classes you want.</li>
          <li><strong>More scoped than scan</strong> — execution role permissions list specific Modify/Delete actions Axiom needs, never <code>*</code>.</li>
          <li><strong>Approval-gated</strong> — Axiom assumes the execution role only after an approval flips a plan item to &quot;approved&quot;. Outside of an approved apply, the execution role is never assumed.</li>
        </ul>
        <p>Axiom presents the exact execution policy at the moment you enable an action class. Nothing speculative.</p>
      </DocSection>

      <DocSection id="azure-future" title="Azure permission model (preview)" kicker="04 · Azure">
        <p>Azure connector ships via <strong>Service Principal</strong> + role assignment:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Read-only scan: <code>Reader</code> built-in role at subscription or resource-group scope</li>
          <li>Plus a custom read-only role for Azure Cost Management + Activity Log analytics</li>
          <li>Execution: separate custom role created per action class (preview Q2 2026)</li>
          <li>No client secret stored — Axiom uses federated identity (workload identity federation) where available</li>
        </ul>
        <p>Subscription/resource-group scoping is enforced at the role assignment level — you control exactly which scopes Axiom sees.</p>
      </DocSection>

      <DocSection id="gcp-future" title="GCP permission model (preview)" kicker="05 · GCP">
        <p>GCP connector ships via <strong>Service Account</strong> + IAM role binding:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Read-only scan: <code>roles/viewer</code> + <code>roles/iam.securityReviewer</code> at project or folder scope</li>
          <li>Plus custom roles for Cloud Billing + Cloud Audit analytics</li>
          <li>Execution: per-action-class custom roles (preview Q3 2026)</li>
          <li>Authentication via workload identity federation — no JSON key files stored on Axiom&apos;s side</li>
        </ul>
      </DocSection>

      <DocSection id="boundaries" title="Approval boundaries" kicker="06 · Boundaries">
        <p>Permission classifications drive approval routing:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Low risk</strong> (contained blast radius, idempotent) — single approver. Can be Trust-Ladder-promoted to auto-apply after measured success.</li>
          <li><strong>Medium risk</strong> (moderate blast, reversible) — single approver. Pre-verified rollback required. Never auto-applied.</li>
          <li><strong>High risk</strong> (broad blast or hard-to-reverse) — multi-party approval. Cannot be auto-applied regardless of Trust Ladder state.</li>
        </ul>
        <p>See <Link href="/docs/approval-workflow" className="text-violet-300 hover:text-violet-200">approval workflow</Link>.</p>
      </DocSection>

      <DocSection id="revoke" title="Revoking access" kicker="07 · Revoke">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>AWS</strong> — delete the IAM role in your AWS console. Axiom loses all access on next assume attempt.</li>
          <li><strong>Azure</strong> — delete the role assignment for the Axiom Service Principal, or disable the SP entirely.</li>
          <li><strong>GCP</strong> — remove the IAM binding from the Service Account, or disable the SA.</li>
          <li><strong>Org-wide</strong> — disconnect from <code>Dashboard → Settings → Connections → Disconnect all</code>. Stops Axiom from attempting future assumptions across all providers.</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What permissions are minimum required?", answer: "AWS: 14 Describe/Get/List actions. Azure: Reader role + custom read role. GCP: viewer + securityReviewer roles." },
            { question: "Why two roles instead of one?", answer: "Read-only is the constant default; execution is an opt-in event. Two roles = the execution surface area is auditable and revocable independently." },
            { question: "Is the scan role safe?", answer: "Yes — no write, no decrypt, no modify. Worst case if compromised: someone reads infrastructure metadata for the regions you authorized." },
            { question: "What gets logged?", answer: "Every assume-role event lands in AWS CloudTrail / Azure Activity Log / GCP Audit Logs in your account — visible to you, not Axiom-controlled." },
            { question: "Can I rotate?", answer: "Yes. External IDs are per-connection. Disconnect + re-onboard generates a fresh trust policy with a new External ID." },
            { question: "What if my org needs a custom role boundary?", answer: "Permission boundaries are fully compatible. The scan role inherits boundary constraints automatically." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/security-model", label: "Security model" }}
        next={{ href: "/docs/audit-logs", label: "Audit logs" }}
      />
      <DocFeedback />
    </>
  );
}
