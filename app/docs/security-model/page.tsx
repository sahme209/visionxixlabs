import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Security model — Axiom Documentation",
  description: "How Axiom isolates tenants, encrypts data, avoids storing secrets, and gives you control over revocation and audit.",
};

export default function SecurityModelPage() {
  return (
    <>
      <DocHeader
        kicker="Trust & security"
        title="The Axiom security model."
        summary="Read-only by default. Assume-role over stored credentials. Multi-tenant isolation at the data layer. Persisted, tenant-scoped audit evidence for supported actions. Revoke anytime by deleting one IAM role."
      />

      <Callout variant="safe" title="One sentence">
        Axiom never stores cloud credentials, never persists secrets, never has write access by default, and gives you a one-click way to remove all access at any time — by deleting the IAM role you created in your own AWS account.
      </Callout>

      <DocSection id="credentials" title="How credentials work" kicker="01 · Credentials">
        <p>
          Axiom never asks for, receives, or stores AWS access keys. We use AWS&apos;s <strong>assume-role</strong> model exclusively.
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>You create an IAM role in your account with a trust policy pointing at our AWS account + your unique External ID</li>
          <li>For each scan, Axiom calls <code>sts:AssumeRole</code> and receives 1-hour temporary credentials</li>
          <li>Credentials live in memory for the duration of the scan only — never persisted</li>
          <li>When the scan completes, credentials are discarded; the next scan re-assumes fresh</li>
        </ul>
        <p>
          The Role ARN itself is stored encrypted at rest. The ARN alone grants nothing — successful assumption requires (a) being our AWS account, (b) presenting the right External ID, (c) the role still existing in your account.
        </p>
      </DocSection>

      <DocSection id="data" title="What Axiom stores — and what it doesn't" kicker="02 · Data">
        <p>
          We store the minimum needed to operate as your cloud agent. We do not store anything we would need to ship product features without.
        </p>
        <TrustGrid
          items={[
            { question: "Resource metadata", answer: "Yes — instance types, regions, tags, configuration settings. This is what powers findings + recommendations." },
            { question: "Access keys / secrets", answer: "Never. Axiom uses assume-role and never sees access keys. Secrets Manager content is never decrypted." },
            { question: "Object content in S3 buckets", answer: "Never. We read bucket configuration (ACL, encryption, lifecycle), not file contents." },
            { question: "Database row contents", answer: "Never. We read RDS configuration metadata, not row data." },
            { question: "CloudTrail event history", answer: "Only configuration of the trail itself. We don't ingest CloudTrail events." },
            { question: "Reasoning + audit trail", answer: "Yes — every scan, finding, plan, approval, and execution is logged immutably. Required for SOC 2 / ISO 27001 audit evidence." },
          ]}
        />
      </DocSection>

      <DocSection id="isolation" title="Multi-tenant isolation" kicker="03 · Isolation">
        <p>
          Axiom is multi-tenant on shared infrastructure but logically isolated at every layer:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>
            <strong>Database isolation:</strong> Every row is scoped to an <code>organizationId</code>. Every query joins through tenant scope. No cross-tenant read path exists.
          </li>
          <li>
            <strong>Operational memory isolation:</strong> Each org&apos;s agent confidence, outcome history, and execution history is keyed independently. One org&apos;s outcomes never influence another&apos;s.
          </li>
          <li>
            <strong>Credential isolation:</strong> Each connection has its own External ID. A malicious or compromised tenant cannot escalate to another tenant&apos;s cloud.
          </li>
          <li>
            <strong>Audit isolation:</strong> <code>AxiomAuditEvent</code> is partitioned by organization. Audit-log export is scoped to your org only.
          </li>
        </ul>
      </DocSection>

      <DocSection id="encryption" title="Encryption" kicker="04 · Encryption">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>In transit:</strong> TLS 1.2+ everywhere — between you and Axiom, between Axiom and AWS, between Axiom services.</li>
          <li><strong>At rest:</strong> Database encryption at rest (managed by the cloud database provider) plus application-level encryption for sensitive metadata (Role ARNs, connection state, audit event before/after states).</li>
          <li><strong>Key management:</strong> Customer-managed KMS keys available on enterprise plans.</li>
        </ul>
      </DocSection>

      <DocSection id="execution" title="Write access — only when you explicitly grant it" kicker="05 · Execution model">
        <p>
          Read-only scans are the default. Execution (where Axiom can actually apply changes) requires a <em>separate</em> connection with a more-scoped role, and every execution goes through approval gates.
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Execution role is opt-in per action class (cost optimization vs. security remediation vs. drift correction)</li>
          <li>Approval is required by default for every production change. Blast-radius classification triggers multi-party approval for broad changes</li>
          <li>Pre-flight snapshot + rollback path is captured before any modification</li>
          <li>Every executed action writes an immutable <code>AxiomAuditEvent</code> with before-state, after-state, and rollback strategy</li>
          <li>Auto-escalation of agent autonomy is blocked at the policy layer — the agent cannot grant itself more permissions over time</li>
        </ul>
      </DocSection>

      <DocSection id="revocation" title="How to revoke all Axiom access" kicker="06 · Revocation">
        <p>
          Two ways to remove Axiom access from your AWS account immediately:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>
            <strong>Delete the IAM role.</strong> In your AWS console → IAM → Roles → select the Axiom role → Delete. We immediately lose all access on the next assume attempt.
          </li>
          <li>
            <strong>Disconnect from the Axiom dashboard.</strong> Settings → Connections → Disconnect. This stops Axiom from attempting future assumptions but does not delete the IAM role itself. We recommend doing both.
          </li>
        </ol>
        <p>
          Disconnection is also available from the desktop application (Settings → Connections) once installed.
        </p>
      </DocSection>

      <DocSection id="compliance" title="Compliance posture" kicker="07 · Compliance">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>SOC 2 Type II — control mapping built into the audit layer; report available under NDA</li>
          <li>ISO 27001 — control mapping in progress</li>
          <li>HIPAA — BAA available on enterprise tier</li>
          <li>GDPR — data processing addendum available; data residency on enterprise tier</li>
          <li>SSO + SAML — supported on growth tier and above</li>
        </ul>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/aws-setup", label: "AWS setup" }}
        next={{ href: "/docs/troubleshooting", label: "Troubleshooting" }}
      />
      <DocFeedback />
    </>
  );
}
