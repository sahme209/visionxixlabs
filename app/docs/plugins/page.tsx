import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = { title: "Apps and skills — V19 Documentation", description: "Browse built-in workflows and manage workspace skill guidance without granting tool access.", alternates: { canonical: "/docs/plugins" } };
export default function PluginsGuide() {
 return <>
  <DocHeader kicker="Workspace · Apps and skills" title="Find a workflow. Add guidance deliberately." summary="Control → Apps & skills separates built-in Apps, optional Skills and Developer tools (MCP). A catalog entry does not mean provider access is ready." />
  <DocSection id="browse" kicker="01" title="Browse the Apps and skills catalog">
   <p>Open <a href="/control/plugins">Apps &amp; skills</a>. Choose <em>Apps</em>, <em>Skills</em> or <em>Developer tools (MCP)</em>, then search by name, description or listed tools. Select an entry&apos;s name to inspect its description, status and tools or scopes.</p>
   <p>Apps are built-in V19 workflows, grouped by provider. They have no separate installation to remove. Choose <em>Manage access</em> to review the provider in Integrations, then use an available governed workflow to prepare an action.</p>
  </DocSection>
  <DocSection id="skills" kicker="02" title="Install, disable or remove a skill">
   <p>Current workspace members can browse. Owners and admins with current workspace access can choose <em>Install</em>, <em>Enable</em>, <em>Disable</em> or <em>Remove</em> on supported optional entries, then confirm the named change. Installed guidance becomes available on the Agent&apos;s next message; it does not rewrite earlier conversations.</p>
   <p>Install adds a new skill. Enable reactivates a disabled skill. If the workspace state changed before confirmation, refresh the catalog and choose the action for the current state.</p>
   <p>In desktop Agent versions with these review skills, explicitly invoke <code>/repository-code-review</code>, <code>/debugging-investigation</code> or <code>/terraform-review</code> to inspect repository source. These invocations use Inspect mode and offer only the skill’s listed read tools, even if Deep Ops is selected. They require the current workspace tool permissions and the relevant GitHub connection. Terraform review reads source and cannot run plan or apply.</p>
   <p>Use <em>Deployment history review</em> in the desktop Agent to inspect the latest recorded workflow outcomes for a selected environment. Invoke <code>/deployment-history-review</code> and name the environment. This review can read workspace environments and up to 20 recorded executions. Service health, artifact provenance and rollback evidence require their own checks.</p>
   <Callout variant="warning" title="Guidance is not permission">Installing a skill never grants credentials, changes tool risk or bypasses action approval. Built-in availability, enabled guidance and permission to execute are separate states.</Callout>
  </DocSection>
  <DocSection id="aws-ec2-observation" kicker="03" title="Use AWS EC2 observation in Agent">
   <p>In V19 versions that include this skill, open <a href="/control/plugins?tab=skills">Apps &amp; skills</a>, find <em>AWS EC2 observation</em> and install or enable it for the workspace. In the desktop Agent, send <code>/aws-ec2-observation</code> with one 12-digit AWS account number. Include the account number in the current request and keep tokens and credentials out of the conversation.</p>
   <p>The skill runs in Inspect mode. It resolves the selected account against the current workspace connections and reads inventory only if there is one connected, unrevoked match and current tool permissions allow it. If no account is selected or the choice is ambiguous, supply a single account number. If the connection is unavailable, review workspace AWS access in Integrations before trying again.</p>
   <p>The observation covers one page of at most five EC2 instances in one enrolled region at the recorded time. An empty page does not establish that the account has no instances. Costs, utilization, backups, other regions and other resource types remain unknown. Use separate release evidence to assess deployment readiness, service health or rollback.</p>
  </DocSection>
  <DocSection id="uncertain" kicker="04" title="When installation state is unknown">
   <p>If installation storage is unavailable, V19 labels the state unknown and does not offer management controls. If an update is not confirmed, refresh the catalog and inspect the saved state before retrying: the change may have completed even if its audit or response failed.</p>
   <p>For Microsoft Learn, choose <em>Open tools</em> and follow the <a href="/docs/mcp-tools">MCP documentation-search guide</a>. Arbitrary packages and server URLs cannot be installed from this catalog.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/ask-axiom",label:"Ask V19"}} next={{href:"/docs/mcp-tools",label:"MCP tools"}} />
 </>;
}
