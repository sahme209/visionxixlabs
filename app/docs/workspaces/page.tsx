import Link from "next/link";
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
   <p>When blocking deployment checks exist, Insights also counts how many recorded deployments in the window had passing evidence for every one of them, how many had a failed check, and how many had no evidence (for example runs before a check was added, or emergency bypasses). It uses today&apos;s blocking checks and matches results by commit.</p>
   <p>Insights also summarizes AI agent requests over the last 30 days: how many there were and from how many agents, how many were approved or allowed, rejected or refused, or are still waiting, and how they were sorted into review lanes.</p>
   <p>Insights also counts deployments refused by a release gate in the last 30 days, by reason: outside the change window, during a freeze, a stability warning without a reason, blocking checks not passed, or the previous ring not deployed. A rising count shows where the release process is slowing teams down.</p>
   <p>Insights also shows a change failure rate: of the releases that finished in the last 90 days, the share that ended failed or rolled back, or that had an incident reported against them afterwards. Releases that never finished are not counted.</p>
  </DocSection>
  <DocSection id="variables" kicker="05" title="Configuration variables per environment">
   <DocFigure src="/docs/cockpit/variables.webp" alt="The Variables page in the V19 cockpit with defaults, overrides and fingerprints" caption="Variables for a synthetic workspace: workspace defaults, environment overrides and a warning for a name set in only some environments." width={1600} height={1000} />
   <p>In the cockpit, <strong>Variables</strong> holds plain configuration such as a base URL, log level or feature switch. Set a workspace default, then override it for an environment that needs a different value; environments without an override inherit the default. A notice lists names that are set for some environments but have no default, so a missing value is visible before a release.</p>
   <p>Each environment shows a short fingerprint of what it resolves to, which changes whenever any value it sees changes. Owners and admins can add, edit and remove variables. Edits carry the version you loaded, so a change made by someone else in the meantime is reported instead of overwritten. Names and values that look like credentials are refused: keep secrets in scoped credentials. Passing variables into deployment workflows is not connected yet, so this page does not change any running service.</p>
   <p>When the desktop app dispatches a deployment to an environment, V19 records that environment's fingerprint and resolved values with the deployment. Each fingerprint card then says whether the configuration still matches the last recorded deployment or has changed since. <strong>Feature switches</strong> shows every variable named <code>FEATURE_…</code> as on, off or its value in each environment, so staged exposure is visible at a glance. <strong>Compare before promoting</strong> lists the values that differ between two environments, and names that exist in only one of them. If the snapshot cannot be recorded, the deployment still runs and the card says no fingerprint was recorded.</p>
   <p><strong>Variable sets</strong> group variables that many environments share, such as the values for one region or tenant. A set has a tag selector, for example <code>region:eu</code>, and applies to every environment whose tags match, so a new environment tagged <code>region:eu</code> picks up the EU values without copying them. An environment override still wins over a set, and a set wins over the workspace default. Each set appears as its own column in the table; choose it as the scope when adding a variable. If two sets that apply to one environment give a name different values, the page warns you, and the set whose short name sorts last applies until you add an override or remove one value. Deleting a set removes its variables with it.</p>
   <p>A variable can point to a secret instead of holding a value. Write <code>secret://aws-sm/prod/db#password</code>, where the provider is <code>aws-sm</code> (AWS Secrets Manager), <code>aws-ssm</code> (Parameter Store), <code>gcp-sm</code> (Google Secret Manager), <code>azure-kv</code> (Azure Key Vault) or <code>vault</code> (HashiCorp Vault). The page labels it as a secret reference. V19 stores only the reference and never reads the secret: your CI reads it from your secret manager at deploy time with its own identity. Environments can point to different secrets through the usual overrides and sets.</p>
   <p>To load configuration in your own CI, call <code>GET /api/v1/environments/{"{slug}"}/variables</code> with an API key that has the <code>pipeline:read</code> scope. It returns the environment&apos;s resolved variables and fingerprint, so your pipeline can export them and record which configuration it deployed. Every SDK has a matching method.</p>
   <p>To read the whole workspace configuration at once, for example to keep it in Git or compare it in CI, call <code>GET /api/v1/config</code> with an API key that has the <code>config:read</code> scope. It returns environments with their tags and change windows, variable sets, every variable with its scope, and the checks file. It never changes anything.</p>
  </DocSection>
  <DocSection id="services" kicker="06" title="Service catalog">
   <DocFigure src="/docs/cockpit/services.webp" alt="The Services page listing repositories with guardrails and the latest run per environment" caption="Services for a synthetic workspace: guardrails and the latest recorded run in each environment." width={1600} height={1000} />
   <p>In the cockpit, <strong>Services</strong> lists every connected repository with its components and owning teams, its guardrails (whether a CODEOWNERS file exists and whether the default branch is protected, from the repository&apos;s last scan), the latest recorded run in each environment over the last 90 days, and how many recent finished runs failed. It is built from recorded data only and is not the live state of your systems; owners appear once components are recorded in V19.</p>
  </DocSection>
  <DocSection id="webhooks" kicker="07" title="Webhooks">
   <DocFigure src="/docs/cockpit/webhooks.webp" alt="The Webhooks page in the V19 cockpit with the event list" caption="Webhooks for a synthetic workspace: choose the events each address receives." width={1600} height={1000} />
   <p>In the cockpit, <strong>Webhooks</strong> sends V19 events to an address you choose, for example a Slack or pager bridge. Owners and admins add a webhook with a name, a public <code>https://</code> address and the events it should receive, such as <code>deployment.blocked</code> or <code>agent_gateway.request_pending</code>. Each event in the list says when it fires.</p>
   <p>When you add a webhook, V19 shows its signing secret once. Copy it into your receiver and check the signature on every delivery. Private and internal addresses are refused, and a webhook that keeps failing is switched off automatically. Revoke a webhook at any time; members can see the list but cannot change it.</p>
  </DocSection>
  <DocSection id="cockpit-pages" kicker="08" title="Every cockpit page">
   <p>The cockpit sidebar, in order, with what each page is for:</p>
   <ul className="mt-3 list-disc space-y-1 pl-5">
    <li><strong>Overview</strong>: Workspace summary and next steps.</li>
    <li><strong>Governance</strong>: Pending Agent approvals, roles, environment policy, promotion lifecycles and policy as code. <Link href="/docs/governance-approvals" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Insights</strong>: Delivery and recovery figures, deployment check evidence and the release evidence pack. <Link href="#insights" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Services</strong>: Repositories with owners, guardrails, the latest run per environment, and Kubernetes rollout templates. <Link href="#services" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Variables</strong>: Configuration per environment, variable sets, feature switches and comparisons. <Link href="#variables" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Checks</strong>: Deployment checks per release stage, results and the generated CI workflow. <Link href="/docs/releaseops#deployment-checks" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>AI &amp; Agents</strong>: AI settings and Agent activity. <Link href="/docs/offline-ai" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Agent gateway</strong>: Governance keys and requests from external agents. <Link href="/docs/agent-gateway" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Trust tools</strong>: Read-only tools that inspect your connected systems. <Link href="/docs/trust-tools" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Airflow</strong>: Airflow connection and automations. <Link href="/docs/batch-providers" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Integrations</strong>: Connected providers and their status. <Link href="/docs/integration-setup" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Apps &amp; skills</strong>: Plugins and skills available to the workspace. <Link href="/docs/plugins" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Members</strong>: People, roles and invitations. <Link href="/docs/members" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Usage &amp; Billing</strong>: Plan, usage and invoices. <Link href="/docs/usage-billing" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Audit &amp; Security</strong>: Audit log and security settings. <Link href="/docs/audit-logs" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>API keys</strong>: Keys for CI, SDKs and agents, with scopes. <Link href="/docs/api-keys" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Webhooks</strong>: Send chosen events to Slack, a pager or your own service. <Link href="#webhooks" className="underline underline-offset-4">Guide</Link></li>
    <li><strong>Settings &amp; sessions</strong>: Your profile and signed-in devices. <Link href="/docs/settings" className="underline underline-offset-4">Guide</Link></li>
   </ul>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/mcp-tools",label:"MCP tools"}} next={{href:"/docs/members",label:"Members and roles"}} />
 </>;
}
