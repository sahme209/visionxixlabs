import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Members and roles — V19 Documentation",
 description: "Invite teammates, change roles, remove members and answer access requests on Control → Members.",
 alternates: { canonical: "/docs/members" },
};
export default function MembersDocsPage() {
 return <>
  <DocHeader kicker="Workspace · People" title="Invite people and manage roles."
   summary="Owners and admins manage members on Control → Members. Every change is recorded in the audit log." />
  <DocFigure src="/docs/cockpit/members.webp" alt="The Members page in the V19 cockpit in a browser" caption="Members in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
  <DocSection id="roles" kicker="01" title="Roles">
   <p><strong>Owner</strong>: full control, one per workspace; ownership moves only through an explicit handoff. <strong>Admin</strong>: manages members, billing, integrations and every engineer setting. <strong>Operator</strong>: runs scans, approves engineer actions and configures the workforce, but cannot manage billing or members. <strong>Security reviewer</strong>: reads findings, approvals and the audit trail, and can vote on approvals but not start engineer actions. <strong>Finance viewer</strong>: reads cost recommendations and panels, with no write access. <strong>Read-only</strong>: reads dashboards; no vote, run or manage.</p>
  </DocSection>
  <DocSection id="invite" kicker="02" title="Invite a teammate">
   <p>Enter an email address, choose a role (Operator by default) and choose <em>Create invitation link</em>. V19 does not email the link: copy it and send it yourself. The owner role cannot be given by invitation.</p>
   <p>Starting in the paired app? See <a href="/docs/settings#desktop-workspace-access">workspace access in desktop Settings</a> for the account and workspace checks on the browser shortcut.</p>
   <Callout variant="info" title="Links expire">Invitation links expire after 7 days. Removing a member also voids every earlier invitation for that email.</Callout>
  </DocSection>
  <DocSection id="change" kicker="03" title="Change a role or remove someone">
   <p>Use <em>Update</em> or <em>Remove</em> on a member&apos;s row. You cannot change your own role or the owner&apos;s. If V19 cannot confirm the audit record for a change, it says so; check the member list before trying again, because the change may already have happened.</p>
   <p>If your workspace is enrolled in Governance, promotions and new invitations wait until membership changes have reviewed Governance coverage. Demoting and removing members always work, so you can reduce access at any time.</p>
  </DocSection>
  <DocSection id="requests" kicker="04" title="Access requests">
   <p>Members can ask for a higher role through Ask V19. Owners and admins see requests from the last 30 days under <em>Access requests</em>, with the reason given. A request never changes anything by itself: if you agree, change the role in the member list.</p>
  </DocSection>
  <DocSection id="scim" kicker="05" title="Provision people from your identity provider (SCIM)">
   <p>Microsoft Entra ID, Okta and other SCIM 2.0 directories can keep your V19 workspace in step with your company directory. Create an API key with the <code>scim:provision</code> scope under API keys, then in your identity provider&apos;s provisioning settings enter:</p>
   <ul className="list-disc space-y-1 pl-5 text-zinc-400">
    <li>Tenant or base URL: <code>https://visionxixlabs.com/api/scim/v2</code></li>
    <li>Secret token: the API key (sent as a bearer token)</li>
    <li>Matching attribute: <code>userName</code> (the person&apos;s email). Users only; group provisioning is not used.</li>
   </ul>
   <p>When the directory adds someone, V19 records them as provisioned but grants nothing: they still join through an invite, and their role comes from the workspace. When the directory deactivates or removes someone, V19 signs them out of every desktop session in this workspace straight away and suspends their membership. The record and the audit trail are kept. The workspace owner is never suspended by SCIM, so a directory mistake cannot lock you out. Reactivating someone in the directory does not restore access by itself: an admin re-admits them. Every change appears in the audit log with the API key that made it. API keys expire after at most 90 days, so put a reminder in your directory to replace the token.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/workspaces",label:"Workspaces"}} next={{href:"/docs/governance-approvals",label:"Governance approvals"}} />
 </>;
}
