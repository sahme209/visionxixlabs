import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = { title: "Workspaces — Axiom Documentation", description: "Choose your active browser workspace using current accepted membership.", alternates: { canonical: "/docs/workspaces" } };
export default function WorkspacesGuide() {
 return <>
  <DocHeader kicker="Workspace · Context" title="Choose the workspace before you act." summary="The sidebar identifies the active workspace and your roles. Choosing a workspace selects existing access; it never creates membership or grants permissions." />
  <DocSection id="choose" kicker="01" title="Choose an active workspace">
   <p>When more than one workspace is available, use the sidebar&apos;s <em>Active workspace</em> selector, choose the intended workspace and select <em>Open workspace</em>. The browser opens Control in that workspace. With one current workspace, the sidebar may show its name without a selector.</p>
   <p>The server checks your signed-in account and accepted membership before saving the browser selection. Recheck the workspace name and role before preparing any action. Switching does not copy records, create a connection or carry an approval into another workspace.</p>
  </DocSection>
  <DocSection id="recover" kicker="02" title="Recover unavailable workspace access">
   <p><a href="/control/workspaces">Workspaces</a> is a recovery destination that directs you to the sidebar. If the current selection is no longer available, choose another workspace offered to your account and select <em>Open workspace</em>. A pending invitation or workspace identifier alone does not establish accepted membership.</p>
   <p>If no valid workspace is offered, confirm the signed-in account and ask an owner or admin to review membership. Do not repeatedly submit a removed workspace or treat a cached page as current access. See <a href="/docs/members">Members and roles</a> for invitations and access requests.</p>
  </DocSection>
  <DocSection id="devices" kicker="03" title="Browser context and paired devices are separate">
   <p>Browser workspace selection does not switch or re-pair the desktop Agent. Check the account and workspace in each surface before continuing. Use <a href="/docs/settings">Settings and sessions</a> to inspect your paired devices for the current workspace.</p>
   <Callout variant="warning" title="Selection is not authorization">Every protected operation still needs its own current role, provider access, policy and approval checks. Opening a workspace is not permission to deploy or approve someone else&apos;s request.</Callout>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/mcp-tools",label:"MCP tools"}} next={{href:"/docs/members",label:"Members and roles"}} />
 </>;
}
