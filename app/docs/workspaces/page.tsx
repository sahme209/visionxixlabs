import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = { title: "Workspaces — V19 Documentation", description: "Choose your active browser workspace using current accepted membership.", alternates: { canonical: "/docs/workspaces" } };
export default function WorkspacesGuide() {
 return <>
  <DocHeader kicker="Workspace · Context" title="Choose the workspace before you act." summary="The sidebar identifies the active workspace and your roles. Choosing a workspace selects existing access; it never creates membership or grants permissions." />
  <DocFigure src="/docs/cockpit/workspaces.webp" alt="The Workspaces page in the V19 cockpit in a browser" caption="Workspaces in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
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
  <DocSection id="insights" kicker="04" title="Delivery insights for the workspace">
   <DocFigure src="/docs/cockpit/insights.webp" alt="The Delivery insights page in the V19 cockpit" caption="Delivery insights in the cockpit, shown for a new synthetic workspace with no runs yet." width={1600} height={1000} />
   <p>In the cockpit, <strong>Insights</strong> shows how often the workspace ships and how quickly it recovers: workflow runs and runs per week, run success rate and median time to complete over the last 30 days, and open incidents with median time to mitigate and resolve over the last 90 days. Figures come only from recorded workflow runs and incidents. A workflow failure is not always a failed change, and lead time from commit is not measured, so treat these as operating signals rather than DORA certification.</p>
  </DocSection>
  <DocSection id="variables" kicker="05" title="Configuration variables per environment">
   <DocFigure src="/docs/cockpit/variables.webp" alt="The Variables page in the V19 cockpit with defaults, overrides and fingerprints" caption="Variables for a synthetic workspace: workspace defaults, environment overrides and a warning for a name set in only some environments." width={1600} height={1000} />
   <p>In the cockpit, <strong>Variables</strong> holds plain configuration such as a base URL, log level or feature switch. Set a workspace default, then override it for an environment that needs a different value; environments without an override inherit the default. A notice lists names that are set for some environments but have no default, so a missing value is visible before a release.</p>
   <p>Each environment shows a short fingerprint of what it resolves to, which changes whenever any value it sees changes. Owners and admins can add, edit and remove variables. Edits carry the version you loaded, so a change made by someone else in the meantime is reported instead of overwritten. Names and values that look like credentials are refused: keep secrets in scoped credentials. Passing variables into deployment workflows is not connected yet, so this page does not change any running service.</p>
   <p>When the desktop app dispatches a deployment to an environment, V19 records that environment's fingerprint and resolved values with the deployment. Each fingerprint card then says whether the configuration still matches the last recorded deployment or has changed since. <strong>Compare before promoting</strong> lists the values that differ between two environments, and names that exist in only one of them. If the snapshot cannot be recorded, the deployment still runs and the card says no fingerprint was recorded.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/mcp-tools",label:"MCP tools"}} next={{href:"/docs/members",label:"Members and roles"}} />
 </>;
}
