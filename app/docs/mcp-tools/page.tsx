import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = { title: "MCP documentation tools — Axiom Documentation", description: "Check Microsoft Learn and search public documentation through the reviewed workspace MCP tool.", alternates: { canonical: "/docs/mcp-tools" } };
export default function McpToolsGuide() {
 return <>
  <DocHeader kicker="Workspace · MCP tools" title="Search official documentation, within a fixed boundary." summary="Control → MCP tools offers Microsoft Learn documentation search. It does not inspect your Azure account or connect arbitrary MCP servers." />
  <DocSection id="enable" kicker="01" title="Prepare Microsoft Learn documentation search">
   <p>An owner or admin opens <a href="/control/plugins?tab=mcp">Apps &amp; skills → Developer tools (MCP)</a>, chooses Microsoft Learn and confirms <em>Install</em> or <em>Enable</em>. Open <a href="/control/mcp">MCP tools</a>. Current membership and workspace access are required for requests; the saved installation must be enabled for search.</p>
   <p>Choose <em>Check connection</em> to see whether the fixed public server responds and offers documentation search. This checks availability only: it does not install the tool, grant cloud access or authorize Agent tools.</p>
  </DocSection>
  <DocSection id="search" kicker="02" title="Search with a public technical topic">
   <p>Enter a short topic, such as <em>Azure App Service managed identity</em>, then choose <em>Search docs</em>. Your topic is sent to Microsoft&apos;s public documentation server. Use public terms only; do not paste credentials, private code, personal information or internal incident details. Queries are limited to 300 characters; unsupported or secret-like input is refused.</p>
   <p>Results show titles, excerpts and links on learn.microsoft.com. They are external reference material, not evidence that your own deployment is configured correctly. Axiom bounds request duration and response size, refuses redirects and rate-limits requests.</p>
   <Callout variant="info" title="Two different MCP directions">This page lets Axiom read a reviewed external documentation tool. To let an external agent request Axiom governance decisions, use the separate <a href="/docs/agent-gateway">Agent gateway guide</a>. Neither connection grants the other&apos;s permissions.</Callout>
  </DocSection>
  <DocSection id="recover" kicker="03" title="If a request is unavailable">
   <p>Check the workspace&apos;s installation state first. Unknown storage state is not an enabled connection. A rate-limit message means wait before trying again. A failed or unconfirmed request is not proof that documentation was read; Axiom requires an audit record before confirming it. Do not repeatedly resend sensitive or unsupported input.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/plugins",label:"Apps and skills"}} next={{href:"/docs/workspaces",label:"Workspaces"}} />
 </>;
}
