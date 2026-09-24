import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Execution plans — Axiom Documentation",
  description: "What an Axiom execution plan contains, how phases work, what verification proves, and how rollback readiness is determined.",
};

export default function ExecutionPlansPage() {
  return (
    <>
      <DocHeader
        kicker="Operate · Execution"
        title="Execution plans."
        summary="A phased, dependency-aware sequence of changes Axiom proposes after a scan. Items can include generated Terraform or CLI review artifacts, blast-radius context, rollback expectations, evidence sources, and approval requirements."
      />

      <Callout variant="safe" title="The contract">
        An execution plan is a proposal — not an action. Nothing applies until you approve. A rollback path is available only when the active adapter and evidence verify it; otherwise the plan must remain blocked or require an explicit manual recovery procedure.
      </Callout>

      <DocSection id="anatomy" title="Anatomy of an execution plan" kicker="01">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Title + summary</strong> — what the plan accomplishes and why</li>
          <li><strong>Total resources affected</strong> — and which provider/region</li>
          <li><strong>Estimated savings/impact</strong> — monthly dollar impact, performance delta, security posture change</li>
          <li><strong>Total duration</strong> — predicted apply time across phases</li>
          <li><strong>Rollback RTO</strong> — measured time-to-restore if anything fails</li>
          <li><strong>Blast radius</strong> — contained (1–5) / moderate (6–20) / broad (20+)</li>
          <li><strong>Phases</strong> — ordered, dependency-aware steps</li>
          <li><strong>Terraform preview</strong> — full IaC diff per phase</li>
          <li><strong>Affected resources</strong> — typed list with create/modify/destroy classification</li>
          <li><strong>Safety checks</strong> — pre-flight conditions that must pass before any apply</li>
        </ul>
      </DocSection>

      <DocSection id="phases" title="How phases work" kicker="02">
        <Step number={1} title="Phase 1 is always snapshot + rollback verification">
          <p>Capture pre-flight state. Verify rollback path can restore that state within the published RTO. ALB drain configured if applicable.</p>
        </Step>
        <Step number={2} title="Subsequent phases group dependent changes together">
          <p>Plans are split into the minimum number of phases that still respect dependency ordering. Each phase has its own approval gate.</p>
        </Step>
        <Step number={3} title="Health verification between phases">
          <p>After each phase, Axiom confirms expected state (health check, cost delta within bounds, no unexpected drift). Failed verification halts the next phase and triggers rollback if configured.</p>
        </Step>
        <Step number={4} title="Final phase locks the outcome">
          <p>Last phase records the cost shift / posture change / drift correction in operational memory. Plan transitions from &quot;executing&quot; to &quot;complete&quot;.</p>
        </Step>
      </DocSection>

      <DocSection id="risk-level" title="Risk levels per item" kicker="03">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Low</strong> — Idempotent, easily reversible, contained blast radius. Single approver.</li>
          <li><strong>Medium</strong> — Reversible with measured RTO, moderate blast. Single approver + rollback verification required.</li>
          <li><strong>High</strong> — Multi-resource impact, requires multi-party approval. Cannot be auto-applied regardless of Trust Ladder state.</li>
        </ul>
      </DocSection>

      <DocSection id="verification" title="What verification proves" kicker="04 · Verification">
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li>The intended resource change actually landed (modify/create/destroy completed at the AWS API level)</li>
          <li>Health checks pass — ALB target group, CloudWatch alarms, custom SLI</li>
          <li>Cost shift is within the predicted range (catches surprise behavior)</li>
          <li>No new drift was introduced (the change didn&apos;t cascade elsewhere)</li>
          <li>The savings/security posture change is real and durable (lock event written to memory)</li>
        </ul>
      </DocSection>

      <DocSection id="rollback-readiness" title="Rollback readiness" kicker="05">
        <p>Every plan item is gated on rollback verification. The criteria:</p>
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>Pre-flight state can be captured (snapshot, configuration export, or AMI)</li>
          <li>Restore path is mechanically possible (re-create resource from snapshot, re-apply prior Terraform, etc.)</li>
          <li>RTO is measured, not estimated</li>
          <li>If any of these fail, the plan item is blocked at the governance gate until resolved</li>
        </ul>
        <p>
          See <Link href="/docs/rollback" className="text-violet-300 hover:text-violet-200">rollback strategy</Link> for the full rollback lifecycle.
        </p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What is an execution plan?", answer: "A reviewable, phased proposal of changes Axiom wants to make. Always reviewable before apply." },
            { question: "Why phased?", answer: "To respect dependencies, isolate failure, and verify health between steps. Each phase is independently approvable." },
            { question: "Is it safe to approve?", answer: "Items only reach you if pre-flight rollback is verified. You see Terraform, blast radius, and RTO before approval." },
            { question: "What happens after apply?", answer: "Health verification confirms the change landed correctly. Memory locks the outcome. Confidence calibrates for similar future actions." },
            { question: "What if it fails mid-phase?", answer: "Rollback fires automatically. Audit log records the failure + rollback outcome. You can re-plan once root cause is addressed." },
            { question: "Can I export instead of apply?", answer: "Yes — every plan generates downloadable Terraform you can apply through your own pipeline." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/approval-workflow", label: "Approval workflow" }}
        next={{ href: "/docs/terraform-export", label: "Terraform & CLI export" }}
      />
      <DocFeedback />
    </>
  );
}
