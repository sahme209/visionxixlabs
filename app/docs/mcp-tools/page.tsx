import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = { title: "MCP documentation tools — V19 Documentation", description: "Check Microsoft Learn and search public documentation through the reviewed workspace MCP tool.", alternates: { canonical: "/docs/mcp-tools" } };
export default function McpToolsGuide() {
 return <>
  <DocHeader kicker="Workspace · MCP tools" title="Search official documentation, within a fixed boundary." summary="Control → MCP tools offers Microsoft Learn documentation search. It does not inspect your Azure account or connect arbitrary MCP servers." />
  <DocFigure src="/docs/cockpit/mcp.webp" alt="The MCP tools page in the V19 cockpit in a browser" caption="MCP tools in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
  <DocSection id="enable" kicker="01" title="Prepare Microsoft Learn documentation search">
   <p>An owner or admin opens <a href="/control/plugins?tab=mcp">Apps &amp; skills → Developer tools (MCP)</a>, chooses Microsoft Learn and confirms <em>Install</em> or <em>Enable</em>. Open <a href="/control/mcp">MCP tools</a>. Current membership and workspace access are required for requests; the saved installation must be enabled for search.</p>
   <p>Choose <em>Check connection</em> to see whether the fixed public server responds and offers documentation search. This checks availability only: it does not install the tool, grant cloud access or authorize Agent tools.</p>
  </DocSection>
  <DocSection id="search" kicker="02" title="Search with a public technical topic">
   <p>Enter a short topic, such as <em>Azure App Service managed identity</em>, then choose <em>Search docs</em>. Your topic is sent to Microsoft&apos;s public documentation server. Use public terms only; do not paste credentials, private code, personal information or internal incident details. Queries are limited to 300 characters; unsupported or secret-like input is refused.</p>
   <p>Results show titles, excerpts and links on learn.microsoft.com. They are external reference material, not evidence that your own deployment is configured correctly. V19 bounds request duration and response size, refuses redirects and rate-limits requests.</p>
   <Callout variant="info" title="Two different MCP directions">This page lets V19 read a reviewed external documentation tool. To let an external agent request V19 governance decisions, use the separate <a href="/docs/agent-gateway">Agent gateway guide</a>. Neither connection grants the other&apos;s permissions.</Callout>
  </DocSection>
  <DocSection id="recover" kicker="03" title="If a request is unavailable">
   <p>Check the workspace&apos;s installation state first. Unknown storage state is not an enabled connection. A rate-limit message means wait before trying again. A failed or unconfirmed request is not proof that documentation was read; V19 requires an audit record before confirming it. Do not repeatedly resend sensitive or unsupported input.</p>
  </DocSection>
  <DocSection id="registry" kicker="04" title="Browse the public MCP server registry">
   <p>Under <strong>MCP server registry</strong> on the MCP tools page, any workspace member can search the public registry at registry.modelcontextprotocol.io, which lists thousands of third-party MCP servers, or pick a topic such as kubernetes, aws or postgres. Each listing shows the publisher&apos;s name, version and description, whether the server is hosted at an https address or runs locally from a package, and a link to the publisher&apos;s page.</p>
   <p>Listings come from their publishers and are not reviewed by V19. Browsing does not connect to any server, send it workspace data or give an agent any tool. Making a listed server available to agents will need its own review and permissions; until then, only the reviewed tools above can be used.</p>
  </DocSection>
  <DocSection id="workspace-servers" kicker="05" title="Add hosted servers to your workspace">
   <p>Owners and admins can choose <strong>Add to workspace</strong> on any registry listing that is hosted at an https address. V19 stores only that address, never credentials, and the server starts disabled. Up to 50 servers can be added per workspace.</p>
   <p><strong>Check connection</strong> starts an MCP session with the server and asks for its list of tools. The check sends no cookies, keys or workspace data, calls no tool, refuses addresses that resolve to private or local networks, follows no redirects, and stops after 8 seconds or 1 MB. It records the outcome (connected, needs credentials, unreachable, refused or not an MCP server) and the tool names. A server can be enabled only after a check that lists its tools, and a later check that fails disables it again.</p>
   <p>Enabling marks a server as approved for the workspace. Agents cannot call its tools yet; that arrives with per-tool approval rules. Adding, enabling, disabling and removing are recorded in the audit log.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/plugins",label:"Apps and skills"}} next={{href:"/docs/workspaces",label:"Workspaces"}} />
 </>;
}
