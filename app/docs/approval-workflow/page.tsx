import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Approval workflow — Axiom Documentation",
  description: "Why every Axiom execution requires explicit approval, what triggers multi-party approval, and how the trust ladder works.",
};

export default function ApprovalWorkflowPage() {
  return (
    <>
      <DocHeader
        kicker="Operate · Approvals"
        title="The approval workflow."
        summary="Nothing modifies your infrastructure without explicit approval. Risk classification determines who must approve. Approvals are immutable, audit-logged, and can be revoked before apply."
      />

      <Callout variant="safe" title="The default">
        Every execution plan item is gated. Auto-apply is opt-in per action class and never enabled by default for production environments.
      </Callout>

      <DocSection id="why" title="Why approvals exist" kicker="01">
        <p>Autonomous agents that bypass human review are unsafe at enterprise scale. Three reasons approvals are mandatory:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Accountability</strong> — every change is attributed to a human approver in the audit trail</li>
          <li><strong>Risk containment</strong> — multi-party approval prevents single-actor mistakes on broad changes</li>
          <li><strong>Trust calibration</strong> — auto-apply autonomy escalates per action class only after a measured history of successful outcomes</li>
        </ul>
      </DocSection>

      <DocSection id="what-requires-approval" title="What requires approval" kicker="02 · Risk tiers">
        <Step number={1} title="Low-risk (contained blast radius)">
          <p>Examples: deleting an unused EBS volume, terminating an idle Lambda, modifying a non-production tag.</p>
          <p>Default: single approver. On the Trust Ladder enterprise tier, low-risk operations can be set to auto-apply after a configured number of successful outcomes.</p>
        </Step>
        <Step number={2} title="Medium-risk (moderate blast radius)">
          <p>Examples: rightsizing an EC2 instance behind an ALB, modifying an RDS parameter group, rotating an IAM access key.</p>
          <p>Default: single approver with mandatory rollback path verification. Never auto-applied.</p>
        </Step>
        <Step number={3} title="High-risk (broad blast radius)">
          <p>Examples: modifying IAM policy on a privileged role, changing a security group attached to many resources, dropping a database resource.</p>
          <p>Default: multi-party approval (2+ approvers). Can never be auto-applied regardless of trust ladder state.</p>
        </Step>
      </DocSection>

      <DocSection id="approver" title="Who can approve" kicker="03">
        <p>By default, any organization member can approve. Enterprise tier supports:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Role-based approval gates (only members with the &quot;approver&quot; role)</li>
          <li>Resource-scoped approvers (only specific resource owners)</li>
          <li>Environment-specific approvers (production approvers vs. staging)</li>
          <li>External approval via ServiceNow Change Request or PagerDuty escalation</li>
        </ul>
      </DocSection>

      <DocSection id="audit" title="Audit trail" kicker="04 · Audit">
        <p>Every approval generates an immutable <code>AxiomApprovalRequest</code> + <code>AxiomAuditEvent</code> pair with:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Approver identity</li>
          <li>Timestamp</li>
          <li>Plan items approved and explicitly rejected</li>
          <li>Optional note from approver</li>
          <li>Pre-apply state and post-apply state</li>
          <li>Rollback strategy at time of approval</li>
        </ul>
        <p>Approvals are revocable until apply begins. After apply starts, rollback is the only path.</p>
      </DocSection>

      <DocSection id="trust-ladder" title="The Trust Ladder" kicker="05 · Safe autonomy boundaries">
        <p>Trust Ladder is the model that lets agent autonomy escalate over time — only after measured success.</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Per action class, the agent tracks success/failure ratio</li>
          <li>After N consecutive successful outcomes (configurable, default 25), the action class can be promoted to auto-apply</li>
          <li>Promotion always requires explicit org-admin approval — the agent cannot self-escalate</li>
          <li>Any failure in an auto-apply class immediately demotes that class back to manual approval</li>
          <li>High-risk classes can never be auto-applied regardless of history</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is happening at approval?", answer: "A human is reviewing a proposed change to your infrastructure before Axiom applies it." },
            { question: "Why approvals?", answer: "Accountability + risk containment + safe autonomy. The default for any autonomous system at enterprise scale." },
            { question: "Is it safe to approve?", answer: "Yes — each item includes blast radius, rollback path, RTO, and Terraform diff. You see exactly what will change." },
            { question: "What happens after I approve?", answer: "Pre-flight snapshot → apply → verification. Rollback fires automatically on health failure." },
            { question: "Can I revoke an approval?", answer: "Yes, until apply begins. After apply, rollback is the recovery path." },
            { question: "What if approval expires?", answer: "After 24 hours unapplied, the plan expires. Re-scan to generate a fresh plan against current state." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/scanning", label: "Infrastructure scanning" }}
        next={{ href: "/docs/execution-plans", label: "Execution plans" }}
      />
      <DocFeedback />
    </>
  );
}
