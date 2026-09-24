import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Rollback strategy — Axiom Documentation",
  description: "How Axiom captures pre-flight state, verifies rollback paths, measures RTO, and executes rollbacks when needed.",
};

export default function RollbackPage() {
  return (
    <>
      <DocHeader
        kicker="Operate · Rollback"
        title="Rollback strategy."
        summary="Axiom records rollback expectations and availability for each execution path. A rollback may be described as verified only when its active adapter, prerequisites, and safe test evidence support that claim."
      />

      <Callout variant="safe" title="The principle">
        Rollback is verified before apply, not after. If Axiom can&apos;t prove it can restore prior state with a measured RTO, the plan item is blocked at the governance gate until the rollback path is in place.
      </Callout>

      <DocSection id="philosophy" title="Philosophy" kicker="01">
        <p>Three rules that make rollback real instead of aspirational:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Pre-flight capture</strong> — Axiom always captures sufficient state to restore before any modification begins</li>
          <li><strong>Measured RTO</strong> — rollback time is measured in advance, not estimated at incident time</li>
          <li><strong>Block if unverified</strong> — plan items without a verified rollback path are blocked at the governance gate</li>
        </ul>
      </DocSection>

      <DocSection id="capture" title="Pre-flight state capture" kicker="02 · Capture">
        <p>Capture mechanism varies by resource type:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>EC2</strong> — AMI snapshot or volume snapshot before any instance modification</li>
          <li><strong>RDS</strong> — manual snapshot before any parameter group, instance-type, or replica change</li>
          <li><strong>S3</strong> — bucket configuration JSON export before ACL/lifecycle/encryption change</li>
          <li><strong>IAM</strong> — policy version preserved by AWS automatically; Axiom captures the policy-version ID</li>
          <li><strong>Security groups</strong> — full rule set captured as Terraform state before any modification</li>
          <li><strong>Lambda</strong> — function configuration + alias version captured</li>
        </ul>
        <p>Capture is audited in the <code>AxiomAuditEvent.beforeState</code> field — immutable and queryable.</p>
      </DocSection>

      <DocSection id="rollback-plan" title="The rollback plan" kicker="03">
        <p>Every plan item has an attached <code>rollbackPlan</code> document containing:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Exact restore commands (Terraform or CLI)</li>
          <li>Pre-flight state reference (snapshot ID, AMI ID, policy version)</li>
          <li>Measured RTO from prior rehearsals on similar resources</li>
          <li>Health verification criteria for confirming restore succeeded</li>
          <li>Escalation path if rollback itself fails</li>
        </ul>
      </DocSection>

      <DocSection id="execution" title="When rollback fires" kicker="04 · Triggers">
        <Step number={1} title="Automatic — health verification failure">
          <p>If post-apply health checks fail (ALB target unhealthy, SLO breach, CloudWatch alarm trip), rollback fires automatically without further approval.</p>
        </Step>
        <Step number={2} title="Automatic — drift detected post-apply">
          <p>If the change produced unexpected drift in dependent resources (cascading impact), rollback fires automatically.</p>
        </Step>
        <Step number={3} title="Manual — operator-triggered">
          <p>From the audit log or dashboard, an authorized user can trigger rollback. Same path as automatic — pre-flight state restored using the stored rollback plan.</p>
        </Step>
        <Step number={4} title="Multi-phase">
          <p>Rollback respects phase boundaries. If phase 3 of 4 fails, only phases 1–3 are rolled back. Phase 4 was never started.</p>
        </Step>
      </DocSection>

      <DocSection id="verification" title="Verification after rollback" kicker="05">
        <p>After rollback completes, Axiom verifies the original state was actually restored:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>Resource configuration matches the captured <code>beforeState</code></li>
          <li>Health checks return to baseline</li>
          <li>Dependent resources show no leftover drift</li>
          <li>Cost shift reverts (no orphaned charges)</li>
        </ul>
        <p>If verification fails, the rollback is escalated — typically meaning rollback itself encountered an unexpected condition (rare, but possible). Manual investigation begins from the audit log.</p>
      </DocSection>

      <DocSection id="limits" title="What rollback cannot do" kicker="06 · Honest limits">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Restore deleted data that wasn&apos;t snapshotted by AWS (some configurations have no native snapshot mechanism)</li>
          <li>Undo write operations into databases that bypass RDS snapshots (manual schema migrations, for example)</li>
          <li>Undo a Lambda execution that already produced external side effects (emails sent, payments processed)</li>
          <li>Reverse a security group rule change that allowed brief intrusion (the change is reverted; the intrusion still happened — incident response is a separate process)</li>
        </ul>
        <p>For these cases, Axiom blocks the plan item at the governance gate. The plan can&apos;t proceed without compensating safety measures.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is rollback?", answer: "A pre-verified path to restore the exact state before an Axiom-executed change, with a measured RTO." },
            { question: "Why verified in advance?", answer: "Rollback verified at incident time is unreliable. Axiom proves it works before approval." },
            { question: "Is rollback safe?", answer: "Yes — it uses the same pre-flight state captured at plan time. No inference, no guessing." },
            { question: "What happens during rollback?", answer: "Pre-flight state is restored. Health checks verify restore succeeded. Audit log records both events." },
            { question: "Can rollback fail?", answer: "Rare but possible if AWS APIs themselves are degraded. Failure is escalated immediately to the audit log + operator." },
            { question: "What if rollback isn't possible?", answer: "Plan item is blocked at the governance gate. Compensating safety measures must be in place before the change can proceed." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/terraform-export", label: "Terraform & CLI export" }}
        next={{ href: "/docs/releaseops", label: "ReleaseOps overview" }}
      />
      <DocFeedback />
    </>
  );
}
