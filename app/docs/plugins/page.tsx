import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = { title: "Apps and skills — Axiom Documentation", description: "Browse built-in workflows and manage workspace skill guidance without granting tool access.", alternates: { canonical: "/docs/plugins" } };
export default function PluginsGuide() {
 return <>
  <DocHeader kicker="Workspace · Apps and skills" title="Find a workflow. Add guidance deliberately." summary="Control → Apps & skills separates built-in Apps, optional Skills and Developer tools (MCP). A catalog entry does not mean provider access is ready." />
  <DocSection id="browse" kicker="01" title="Browse the Apps and skills catalog">
   <p>Open <a href="/control/plugins">Apps &amp; skills</a>. Choose <em>Apps</em>, <em>Skills</em> or <em>Developer tools (MCP)</em>, then search by name, description or listed tools. Select an entry&apos;s name to inspect its description, status and tools or scopes.</p>
   <p>Apps are built-in Axiom workflows, grouped by provider. They have no separate installation to remove. Choose <em>Manage access</em> to review the provider in Integrations, then use an available governed workflow to prepare an action.</p>
  </DocSection>
  <DocSection id="skills" kicker="02" title="Install, disable or remove a skill">
   <p>Current workspace members can browse. Owners and admins with current workspace access can choose <em>Install</em>, <em>Enable</em>, <em>Disable</em> or <em>Remove</em> on supported optional entries, then confirm the named change. Installed guidance becomes available on the Agent&apos;s next message; it does not rewrite earlier conversations.</p>
   <p>For example, a repository-review skill helps the Agent inspect source. Its tools still need their own workspace permissions and provider connection. Check these separately in Integrations and AI &amp; Agents.</p>
   <Callout variant="warning" title="Guidance is not permission">Installing a skill never grants credentials, changes tool risk or bypasses action approval. Built-in availability, enabled guidance and permission to execute are separate states.</Callout>
  </DocSection>
  <DocSection id="uncertain" kicker="03" title="When installation state is unknown">
   <p>If installation storage is unavailable, Axiom labels the state unknown and does not offer management controls. If an update is not confirmed, refresh the catalog and inspect the saved state before retrying: the change may have completed even if its audit or response failed.</p>
   <p>For Microsoft Learn, choose <em>Open tools</em> and follow the <a href="/docs/mcp-tools">MCP documentation-search guide</a>. Arbitrary packages and server URLs cannot be installed from this catalog.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/ask-axiom",label:"Ask Axiom"}} next={{href:"/docs/mcp-tools",label:"MCP tools"}} />
 </>;
}
