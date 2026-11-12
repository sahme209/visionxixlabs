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
   <Callout variant="info" title="Approval is not execution">For reviewed branch, file, pull-request and AWS restart proposals, approving records your decision only. The requester runs the action separately, and the page says so.</Callout>
  </DocSection>
  <DocSection id="rules" kicker="03" title="Approval rules">
   <p>An approval is bound to the exact action, expires after 24 hours and is used once before the action runs. An expired proposal, or one without an integrity binding, cannot be approved: ask for a fresh proposal, because an old approval cannot restore it. <em>Reject</em> means nothing was executed.</p>
  </DocSection>
  <DocSection id="limits" kicker="04" title="What this page shows">
   <p>The inbox shows up to 20 pending actions. It is not a complete approval or outcome history; use the audit log for that.</p>
  </DocSection>
  <DocSection id="scope" kicker="05" title="Workspace and platform approvals are different">
   <p>This inbox is for your workspace's Agent proposals. Release, ticket and connected-app reviews belong to their own exact workflows; a decision in one does not authorize an action in another.</p>
   <p>A workspace owner or reviewer is not automatically an Axiom platform administrator. Axiom's own deployment and issuer controls require separate platform authority. The prepared platform-control workflow remains local development work, not a control available from this inbox or proof of complete Governance enforcement.</p>
  </DocSection>
  <DocSection id="outcomes" kicker="06" title="Read the result before trying again">
   <p>Approval means a decision was recorded; it does not prove an action ran or succeeded. When execution is separate, the original requester must use the exact approved action and the service checks current permissions again.</p>
   <p>If the result is unknown or a response is lost, retain the original action or request reference and inspect its saved history. Do not automatically resend it, create a replacement, or assume that an expired review means nothing happened. A later observation can add evidence without erasing the original attempt.</p>
   <Callout variant="info" title="Different evidence answers different questions">A provider accepting a command is not proof a deployment is healthy. A recorded issuer drain is not proof existing credentials were revoked or expired. Read the exact workflow's outcome and limitations; a historical record does not grant new permission.</Callout>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/members",label:"Members and roles"}} next={{href:"/docs/usage-billing",label:"Usage and billing"}} />
 </>;
}
