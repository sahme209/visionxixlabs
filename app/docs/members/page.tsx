import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Members and roles — Axiom Documentation",
 description: "Invite teammates, change roles, remove members and answer access requests on Control → Members.",
 alternates: { canonical: "/docs/members" },
};
export default function MembersDocsPage() {
 return <>
  <DocHeader kicker="Workspace · People" title="Invite people and manage roles."
   summary="Owners and admins manage members on Control → Members. Every change is recorded in the audit log." />
  <DocSection id="roles" kicker="01" title="Roles">
   <p><strong>Owner</strong>: full control, one per workspace; ownership moves only through an explicit handoff. <strong>Admin</strong>: manages members, billing, integrations and every engineer setting. <strong>Operator</strong>: runs scans, approves engineer actions and configures the workforce, but cannot manage billing or members. <strong>Security reviewer</strong>: reads findings, approvals and the audit trail, and can vote on approvals but not start engineer actions. <strong>Finance viewer</strong>: reads cost recommendations and panels, with no write access. <strong>Read-only</strong>: reads dashboards; no vote, run or manage.</p>
  </DocSection>
  <DocSection id="invite" kicker="02" title="Invite a teammate">
   <p>Enter an email address, choose a role (Operator by default) and choose <em>Create invitation link</em>. Axiom does not email the link: copy it and send it yourself. The owner role cannot be given by invitation.</p>
   <Callout variant="info" title="Links expire">Invitation links expire after 7 days. Removing a member also voids every earlier invitation for that email.</Callout>
  </DocSection>
  <DocSection id="change" kicker="03" title="Change a role or remove someone">
   <p>Use <em>Update</em> or <em>Remove</em> on a member&apos;s row. You cannot change your own role or the owner&apos;s. If Axiom cannot confirm the audit record for a change, it says so; check the member list before trying again, because the change may already have happened.</p>
  </DocSection>
  <DocSection id="requests" kicker="04" title="Access requests">
   <p>Members can ask for a higher role through Ask Axiom. Owners and admins see requests from the last 30 days under <em>Access requests</em>, with the reason given. A request never changes anything by itself: if you agree, change the role in the member list.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/ask-axiom",label:"Ask Axiom"}} next={{href:"/docs/governance-approvals",label:"Governance approvals"}} />
 </>;
}
