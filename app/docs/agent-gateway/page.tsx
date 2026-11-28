import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Agent gateway — V19 Documentation",
 description: "Let Cursor, Claude Code, Codex or your own agent ask V19 before a consequential action, with human approval and a recorded outcome.",
 alternates: { canonical: "/docs/agent-gateway" },
};
export default function AgentGatewayDocsPage() {
 return <>
  <DocHeader kicker="Agents · Governance" title="Govern any AI agent."
   summary="Agents ask V19 before a consequential action. A person approves the exact change, and the outcome is recorded." />
  <Callout title="Cooperative control point">Agents report their own actions to the gateway. It is a control point for agents that cooperate, not a sandbox: it cannot stop an agent that ignores it. Keep provider permissions least-privilege as well.</Callout>
  <DocFigure src="/docs/cockpit/agent-gateway.webp" alt="The Agent gateway page in the V19 cockpit in a browser" caption="Agent gateway in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
  <DocSection id="connect" kicker="01" title="Connect an agent">
   <p>A workspace owner or admin creates a key on <Link href="/docs/api-keys">Control → API keys</Link> with <code>governance:read</code> and <code>governance:request</code>. Add <code>https://visionxixlabs.com/api/v1/mcp</code> to the agent as a remote MCP server with the header <code>Authorization: Bearer vxlk_live_…</code>.</p>
   <p>The agent then sees four tools: <code>axiom_check_policy</code>, <code>axiom_request_approval</code>, <code>axiom_get_approval</code> and <code>axiom_record_outcome</code>. The same operations exist as REST endpoints under <code>/api/v1/governance</code> and in the SDKs.</p>
  </DocSection>
  <DocSection id="decisions" kicker="02" title="How requests are decided">
   <dl className="space-y-4">
    <div><dt className="font-semibold text-white">Allowed</dt><dd>Low-risk work such as reading code, editing a branch or opening a pull request in development or staging.</dd></div>
    <div><dt className="font-semibold text-white">Needs approval</dt><dd>Merges, dependency changes, infrastructure, deploys (unless <a href="#release-autopilot" className="underline underline-offset-4">release autopilot</a> covers them), data migrations, commands and anything in production or an unknown environment. A change whose files touch migrations, CI, auth, infrastructure or secrets also needs approval.</dd></div>
    <div><dt className="font-semibold text-white">Denied</dt><dd>Reading production secrets and deleting production resources. These are never approvable through the gateway. While a production environment is frozen, production deploys, merges, infrastructure changes and data migrations are denied too, with the freeze&apos;s reason.</dd></div>
   </dl>
  </DocSection>
  <DocSection id="approve" kicker="03" title="Approve or reject">
   <p>Pending requests appear on <strong>Control → Agent gateway</strong>, with optional webhook alerts (<code>agent_gateway.request_pending</code>). An owner or admin who did not create the agent&apos;s key decides. Approval covers the exact action and file list, and expires after 24 hours.</p>
   <p>The agent proceeds only when <code>mayProceed</code> is true, then reports <code>succeeded</code>, <code>failed</code> or <code>abandoned</code>. Each agent gets a scorecard; its trust level is evidence only and never changes what policy allows.</p>
  </DocSection>
  <DocSection id="ci" kicker="04" title="Gate a CI deploy">
   <p>Without MCP, use the CLI: <code>vxl ask deploy --target owner/repo --env production --summary &quot;Ship v2&quot; --wait 1800 &amp;&amp; ./deploy.sh</code>. It exits 0 only when the action is allowed or approved.</p>
  </DocSection>
  <DocSection id="firewall" kicker="05" title="Agent firewall">
   <p>The top of <strong>Control → Agent gateway</strong> lists the rules V19 always enforces for agents. Agents never receive provider credentials: their keys can only ask, and V19 runs an approved action with its own short-lived token. Writes and deployments run only after a person approves that exact action. An approved Agent deployment faces the same change window, freezes, deployment checks and rings as a person&apos;s, with no emergency bypass. Production secret reads and deletes are always refused.</p>
   <p>Below the rules, V19 lists anything in your workspace that weakens them, each with the fix: API keys that can start pipelines without the gateway, agent keys that never expire, production environments without an approval policy, and production environments without a change window.</p>
  </DocSection>
  <DocSection id="passport" kicker="06" title="Change passport">
   <p>Every agent request carries a change passport, recorded when the request arrives: which agent made it, the model it reports (V19 never guesses one), the tools it used, and the person accountable for it. For an external agent, that person is whoever created its API key; for V19&apos;s own Agent, it is the person who asked. Agents can send <code>model</code> and <code>tools</code> with a request. The passport is shown on each request with who decided it, and a digest lets you check it later. These facts are not part of what is approved, so they never change an approval.</p>
  <p>When an Agent proposal deploys to an environment that is frozen, outside its change window or has an unreadable window rule, the desktop proposal card says so before you approve, with the freeze reason and the next opening. It is advisory: the gate is checked again when the deployment is dispatched.</p>
  </DocSection>
  <DocSection id="triage" kicker="07" title="Review lanes by blast radius">
   <p>Each request is sorted into a review lane the moment it arrives, with a one-line reason. <em>Allowed by policy</em> needs no review. <em>Quick look</em> is a contained change outside production. <em>Careful review</em> is a production change, a high-risk action or a moderate blast radius. <em>Two approvers</em> is a production change that touches many areas, touches migrations, auth, secrets, CI or infrastructure, or is a data migration, infrastructure change or delete. In that lane the first approval is recorded and the request stays pending until a different admin approves too. Lanes only ever add review; they never remove what policy requires.</p>
  </DocSection>
  <DocSection id="release-autopilot" kicker="08" title="Release autopilot">
   <p>A workspace can let agents deploy small, contained changes to development or staging without waiting for a person. Add an <code>autopilot</code> section to the policy file, for example <code>{`"autopilot": { "deploy": { "environments": ["staging"], "maxFiles": 10 } }`}</code>, and propose it from Governance → Policy as code. Turning autopilot on or widening it is marked as loosening governance, and a different owner or admin must approve it before it applies. A policy file without the section turns autopilot off.</p>
   <p>An agent deploy is then allowed only when all of these hold: the environment is one the rule names, the agent listed the changed files, there are no more than <code>maxFiles</code> of them, the blast radius is contained, and no file touches migrations, CI, auth, infrastructure or secrets. Otherwise it waits for review as before. Production is never covered: the policy file refuses it. If the rule cannot be read, deploys wait for review. Each request records the reason it was allowed, and agents still report the outcome.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/approval-workflow",label:"Approval workflow"}} next={{href:"/docs/trust-tools",label:"Trust tools"}} />
 </>;
}
