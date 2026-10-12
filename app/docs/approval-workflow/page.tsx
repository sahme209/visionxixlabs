import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Approval workflow — Axiom Documentation",
  description: "How Axiom separates agent proposals, administrator approval, execution, and audit evidence.",
};

export default function ApprovalWorkflowPage() {
  return (
    <>
      <DocHeader
        kicker="Governance · Approvals"
        title="A write starts as a proposal."
        summary="The Agent can inspect low-risk context, but GitHub writes, deployment-target changes, identity configuration, and deployments stop at an explicit approval boundary."
      />

      <Callout variant="safe" title="The released boundary">
        Medium- and high-risk tool calls do not execute inside the decision loop. A workspace administrator must approve the persisted proposal before the server invokes the real write function.
      </Callout>

      <DocSection id="risk" title="Risk classification" kicker="01">
        <ul className="ml-1 list-inside list-disc space-y-1.5 text-zinc-400">
          <li><strong>Low risk:</strong> read-only checks can execute inline and are still recorded.</li>
          <li><strong>Medium risk:</strong> reversible configuration or repository changes require approval.</li>
          <li><strong>High risk:</strong> deployments and sensitive configuration require approval.</li>
          <li><strong>Production context:</strong> risk can only escalate; it is never reduced for convenience.</li>
        </ul>
      </DocSection>

      <DocSection id="decision" title="Approve or reject" kicker="02">
        <p>The proposal shows the requested tool, arguments, risk, workspace, and status. Approval and rejection use separate authenticated endpoints. The Agent cannot approve its own request.</p>
      </DocSection>

      <DocSection id="execution" title="Execution and recovery" kicker="03">
        <p>After approval, Axiom calls the same scoped responder used by the product surface. For AWS ECS, the tenant workflow captures the current task definition, waits for steady state, and restores the prior definition if stabilization fails.</p>
      </DocSection>

      <DocSection id="audit" title="Audit evidence" kicker="04">
        <p>Every tool call receives an action record, including low-risk reads. The record distinguishes proposed, approved, rejected, executed, and failed states so observation is as reviewable as mutation.</p>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid items={[
          { question: "Can the Agent write without approval?", answer: "Not through the released medium- and high-risk tool path." },
          { question: "Can production lower the risk?", answer: "No. Production context raises risk; it never lowers it." },
          { question: "Who approves?", answer: "A workspace administrator authenticated through the desktop-session path." },
          { question: "Are reads recorded?", answer: "Yes. Low-risk tool calls receive executed action records." },
          { question: "Does approval prove success?", answer: "No. Approval authorizes execution; the external result and validation provide outcome evidence." },
          { question: "Is every rollback universal?", answer: "No. The documented automatic rollback applies to the released ECS workflow." },
        ]} />
      </DocSection>

      <DocFooterNav prev={{ href: "/docs/releaseops", label: "ReleaseOps overview" }} next={{ href: "/docs/security-model", label: "Security model" }} />
      <DocFeedback />
    </>
  );
}
