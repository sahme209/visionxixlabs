import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Governance approvals — V19 Documentation",
 description: "Review and decide pending Agent actions on Control → Governance.",
 alternates: { canonical: "/docs/governance-approvals" },
};
export default function GovernanceApprovalsDocsPage() {
 return <>
  <DocHeader kicker="Workspace · Approvals" title="Decide pending Agent actions."
   summary="Control → Governance lists Agent actions waiting for a decision, your workspace's roles and each environment's approval policy." />
  <DocFigure src="/docs/cockpit/governance.webp" alt="The Governance page in the V19 cockpit in a browser" caption="Governance in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
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
   <p>A workspace owner or reviewer is not automatically an V19 platform administrator. V19's own deployment and issuer controls require separate platform authority. The prepared platform-control workflow remains local development work, not a control available from this inbox or proof of complete Governance enforcement.</p>
  </DocSection>
  <DocSection id="outcomes" kicker="06" title="Read the result before trying again">
   <p>Approval means a decision was recorded; it does not prove an action ran or succeeded. When execution is separate, the original requester must use the exact approved action and the service checks current permissions again.</p>
   <p>If the result is unknown or a response is lost, retain the original action or request reference and inspect its saved history. Do not automatically resend it, create a replacement, or assume that an expired review means nothing happened. A later observation can add evidence without erasing the original attempt.</p>
   <Callout variant="info" title="Different evidence answers different questions">A provider accepting a command is not proof a deployment is healthy. A recorded issuer drain is not proof existing credentials were revoked or expired. Read the exact workflow's outcome and limitations; a historical record does not grant new permission.</Callout>
  </DocSection>
  <DocSection id="policy-as-code" kicker="07" title="Keep policy rules in Git">
   <p>Owners and admins can choose <em>Download policy file</em> under Policy as code on the Governance page. The file lists this workspace's policy rules in a stable, sorted JSON format, so it can be reviewed and versioned like code.</p>
   <p>Paste a changed file and choose <em>Preview changes</em> to see added, changed and removed rules. Changes that weaken governance are listed under <em>Loosens governance</em>: a rule that no longer blocks releases, is disabled, newly allows exceptions, no longer requires evidence, or is removed. A preview never changes a rule.</p>
   <p>To apply a file, choose <em>Request this change</em>. The request records the diff and a fingerprint of the current rules, and appears under <em>Change requests</em> with what it adds, changes and disables. A different owner or admin must choose <em>Approve and apply</em>; the person who requested it cannot. Approval applies the whole file in one step, and only if the rules still match the fingerprint; if anything changed since the request, it is marked stale and nothing is applied. Rules removed from the file are disabled rather than deleted, so their history remains.</p>
  </DocSection>
  <DocSection id="lifecycles" kicker="08" title="Promotion lifecycles">
   <DocFigure src="/docs/cockpit/lifecycles.webp" alt="Promotion lifecycles on the Governance page, showing two repositories and a warning" caption="Promotion lifecycles for a synthetic workspace: one repository promotes Development to Staging to Production, the other can reach Production directly." width={1600} height={996} />
   <p>Under <em>Promotion lifecycles</em>, Governance shows for each repository the order releases move through environments. The order comes from enabled branch policies that require promotion from an earlier environment; environments in the same box have no order between them.</p>
   <p>Warnings point out gaps: a production environment that can receive a release never deployed to an earlier environment, promotion from the same or a later stage, promotion from an environment that no longer exists, and environments that require promotion from each other. Deployment checks enforce the policies; this view does not change them.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/members",label:"Members and roles"}} next={{href:"/docs/usage-billing",label:"Usage and billing"}} />
 </>;
}
