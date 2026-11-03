import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Execution plans — Axiom Documentation",
  description: "Understand the difference between a saved plan, independent review, an execution attempt and a verified result.",
  alternates: { canonical: "/docs/execution-plans" },
};

export default function ExecutionPlansPage() {
  return <>
    <DocHeader kicker="Workflow reference · Plans" title="Understand a saved plan."
      summary="A plan records intended work. Review, current access, execution and outcome evidence are separate steps." />

    <Callout title="Guide scope">
      Availability depends on the installed version and supported workflow. Exact plan content and controls vary. Some workflows described in these guides are local previews, not production-activated features. A saved plan is not execution authority; this reference does not establish complete Governance enforcement or activation.
    </Callout>

    <DocSection id="read" title="Read the proposed change" kicker="01">
      <p>Before reviewing a plan, identify what it proposes and where its effects would occur. Field names vary by workflow; inspect the exact record rather than assuming every plan contains the same fields.</p>
      <dl className="space-y-4">
        <div><dt className="font-semibold text-white">Source</dt><dd>The repository, branch, tag, commit or other source evidence shown for this request. Check which revision the review actually covers.</dd></div>
        <div><dt className="font-semibold text-white">Target</dt><dd>The account, environment, service, ticket or connected-app destination. A familiar name alone is not proof that it is the intended target.</dd></div>
        <div><dt className="font-semibold text-white">Change</dt><dd>The exact action and content proposed. Read the displayed payload and limitations before making a decision.</dd></div>
        <div><dt className="font-semibold text-white">Review and window</dt><dd>Who must act, the saved revision, and any displayed expiry or execution window. A recorded date is not permission to extend it.</dd></div>
      </dl>
      <p><Link href="/docs/approval-workflow">Review and execution guidance</Link> explains the registered Agent workflow. <Link href="/docs/releaseops/readiness">Release readiness</Link> explains why a recorded request is not enough to establish readiness.</p>
    </DocSection>

    <DocSection id="states" title="Keep four different states separate" kicker="02">
      <p>These are concepts for reading a workflow, not a promise that every installed surface uses the same status names or controls.</p>
      <div><h3 className="font-semibold text-white">Saved plan</h3><p>The intended work is recorded. Saving does not grant permissions, record an independent decision or prove that a provider was contacted.</p></div>
      <div><h3 className="font-semibold text-white">Independent review</h3><p>An authorized reviewer records a decision about the exact version shown. That decision is not an execution receipt. Who may execute, and whether execution is separate, depends on the supported workflow and installed version.</p></div>
      <div><h3 className="font-semibold text-white">Execution attempt</h3><p>The supported execution path checks current authority and the exact action. An attempt may be refused, fail or remain uncertain. An acknowledgment or completed HTTP request is not proof of the intended external result.</p></div>
      <div><h3 className="font-semibold text-white">Verified outcome</h3><p>Use the workflow’s actual provider observation or readback. A deployment dispatch does not prove application health or rollback; those need their own evidence.</p></div>
    </DocSection>

    <DocSection id="changes" title="When the plan or access changes" kicker="03">
      <p>Compare the current source, target, proposed content and saved revision with the exact review. Do not reuse an expired review or assume an old approval covers changed work. Follow the workflow’s supported refresh or new-review path when it is available.</p>
      <p>Do not edit old history, extend a deadline yourself or assume a consumed attempt can be renewed. Renewal and recovery rules are workflow-specific; this guide grants no exception.</p>
    </DocSection>

    <DocSection id="unknown" title="When the outcome is unknown" kicker="04">
      <Callout variant="warning" title="Inspect before another action">
        Do not resend an uncertain or consumed action. A timeout does not prove that no write occurred. Keep the original request and inspect its supported read-only history or recovery state.
      </Callout>
      <p><Link href="/docs/troubleshooting">Inspect an uncertain operation</Link> before preparing any replacement. If further review is needed, involve the authorized requester and independent reviewer. Do not post private operation identifiers, tokens, source contents or customer data in public URLs.</p>
      <p><Link href="/account/help">Account help (sign-in required)</Link> is separate from reading this public reference.</p>
    </DocSection>

    <DocFooterNav prev={{ href: "/docs/permissions-model", label: "Permissions model" }} next={{ href: "/docs/approval-workflow", label: "Approval workflow" }} />
  </>;
}
