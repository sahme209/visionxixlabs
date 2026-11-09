import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Governance approvals — Axiom Documentation",
 description: "Review and decide pending Agent actions on Control → Governance.",
 alternates: { canonical: "/docs/governance-approvals" },
};
export default function GovernanceApprovalsDocsPage() {
 return <>
  <DocHeader kicker="Workspace · Approvals" title="Decide pending Agent actions."
   summary="Control → Governance lists Agent actions waiting for a decision, your workspace's roles and each environment's approval policy." />
  <DocSection id="who" kicker="01" title="Who can decide">
   <p>Owners, admins, operators and security reviewers can record an approval. Nobody can approve their own proposal: another authorized reviewer must. The person who proposed an action can always cancel it.</p>
  </DocSection>
  <DocSection id="review" kicker="02" title="Review an action">
   <p>Each pending action shows its tool, risk level and when it was created. Branch, file-commit and pull-request proposals include their exact changes, for example <em>Review file changes</em> or <em>Review pull request</em>. Read them before deciding.</p>
   <Callout variant="info" title="Approval is not execution">For branch, file and pull-request proposals, approving records your decision only. The requester runs the action separately, and the page says so.</Callout>
  </DocSection>
  <DocSection id="rules" kicker="03" title="Approval rules">
   <p>An approval is bound to the exact action, expires after 24 hours and is used once before the action runs. An expired proposal, or one without an integrity binding, cannot be approved: ask for a fresh proposal, because an old approval cannot restore it. <em>Reject</em> means nothing was executed.</p>
  </DocSection>
  <DocSection id="limits" kicker="04" title="What this page shows">
   <p>The inbox shows up to 20 pending actions. It is not a complete approval or outcome history; use the audit log for that.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/members",label:"Members and roles"}} next={{href:"/docs/usage-billing",label:"Usage and billing"}} />
 </>;
}
