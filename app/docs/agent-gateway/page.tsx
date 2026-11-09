import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Agent gateway — Axiom Documentation",
 description: "Let Cursor, Claude Code, Codex or your own agent ask Axiom before a consequential action, with human approval and a recorded outcome.",
 alternates: { canonical: "/docs/agent-gateway" },
};
export default function AgentGatewayDocsPage() {
 return <>
  <DocHeader kicker="Agents · Governance" title="Govern any AI agent."
   summary="Agents ask Axiom before a consequential action. A person approves the exact change, and the outcome is recorded." />
  <Callout title="Cooperative control point">Agents report their own actions to the gateway. It is a control point for agents that cooperate, not a sandbox: it cannot stop an agent that ignores it. Keep provider permissions least-privilege as well.</Callout>
  <DocSection id="connect" kicker="01" title="Connect an agent">
   <p>A workspace owner or admin creates a key on <Link href="/docs/api-keys">Control → API keys</Link> with <code>governance:read</code> and <code>governance:request</code>. Add <code>https://visionxixlabs.com/api/v1/mcp</code> to the agent as a remote MCP server with the header <code>Authorization: Bearer vxlk_live_…</code>.</p>
   <p>The agent then sees four tools: <code>axiom_check_policy</code>, <code>axiom_request_approval</code>, <code>axiom_get_approval</code> and <code>axiom_record_outcome</code>. The same operations exist as REST endpoints under <code>/api/v1/governance</code> and in the SDKs.</p>
  </DocSection>
  <DocSection id="decisions" kicker="02" title="How requests are decided">
   <dl className="space-y-4">
    <div><dt className="font-semibold text-white">Allowed</dt><dd>Low-risk work such as reading code, editing a branch or opening a pull request in development or staging.</dd></div>
    <div><dt className="font-semibold text-white">Needs approval</dt><dd>Merges, dependency changes, infrastructure, deploys, data migrations, commands and anything in production or an unknown environment. A change whose files touch migrations, CI, auth, infrastructure or secrets also needs approval.</dd></div>
    <div><dt className="font-semibold text-white">Denied</dt><dd>Reading production secrets and deleting production resources. These are never approvable through the gateway.</dd></div>
   </dl>
  </DocSection>
  <DocSection id="approve" kicker="03" title="Approve or reject">
   <p>Pending requests appear on <strong>Control → Agent gateway</strong>, with optional webhook alerts (<code>agent_gateway.request_pending</code>). An owner or admin who did not create the agent&apos;s key decides. Approval covers the exact action and file list, and expires after 24 hours.</p>
   <p>The agent proceeds only when <code>mayProceed</code> is true, then reports <code>succeeded</code>, <code>failed</code> or <code>abandoned</code>. Each agent gets a scorecard; its trust level is evidence only and never changes what policy allows.</p>
  </DocSection>
  <DocSection id="ci" kicker="04" title="Gate a CI deploy">
   <p>Without MCP, use the CLI: <code>vxl ask deploy --target owner/repo --env production --summary &quot;Ship v2&quot; --wait 1800 &amp;&amp; ./deploy.sh</code>. It exits 0 only when the action is allowed or approved.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/approval-workflow",label:"Approval workflow"}} next={{href:"/docs/trust-tools",label:"Trust tools"}} />
 </>;
}
