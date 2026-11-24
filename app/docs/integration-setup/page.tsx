import type { Metadata } from "next";
import Link from "next/link";
import { Callout, CodeBlock, DocFeedback, DocFooterNav, DocHeader, DocSection, Step } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Release integration setup — V19 Documentation",
  description: "Review GitHub App and Airflow setup, connection states, and the implementation limits for Slack, Teams and Linear.",
};

const ORIGIN = "https://visionxixlabs.com";

export default function IntegrationSetupPage() {
  return (
    <article className="docs-prose">
      <DocHeader
        kicker="Connections"
        title="Operator integration configuration"
        summary="Use the setup for your provider and installed version. OAuth registration, workspace consent and connection validation are separate steps."
      />

      <Callout variant="safe" title="Two separate responsibilities">
        For supported OAuth connections, the <strong>service operator</strong> registers the application, callback URL and server-side secret. A <strong>workspace owner or admin</strong> uses the available Connect control, reviews provider consent and returns to V19 for validation.
      </Callout>

      <Callout>
        These callback addresses are for the service operator to register with each provider, not links to start a connection. Opening a callback directly will be rejected because there is no active authorization state. When your version offers the connection, start from its Connect control in the desktop app. Never share a callback containing authorization codes or state.
      </Callout>
      <DocSection id="shared" title="Before connecting a provider" kicker="Service operator checklist">
        <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-300">
          <li>Set the production V19 origin as <code>NEXTAUTH_URL</code>; callback construction fails closed when the origin is not trusted.</li>
          <li>Register the exact HTTPS callback shown below. Wildcard callback domains are not supported.</li>
          <li>Store client secrets only in the hosting platform&apos;s encrypted secret manager—never in <code>NEXT_PUBLIC_*</code>, the desktop app, logs, or Git.</li>
          <li>Redeploy the service after adding credentials, then use Apps &amp; skills or Settings → Integrations to start consent.</li>
          <li>Run the harmless validation step. V19 does not label a connection active from consent alone.</li>
        </ol>
      </DocSection>

      <DocSection id="github" title="GitHub App" kicker="Repository-scoped code and release evidence">
        <p>Use this setup to grant the app access to selected repositories. <Link href="/docs/oauth-setup#github" className="underline underline-offset-4">GitHub account sign-in</Link> uses a separate OAuth flow.</p>
        <Step number={1} title="Register the installation callback">
          <CodeBlock language="text">{`${ORIGIN}/api/integrations/github/install-callback`}</CodeBlock>
        </Step>
        <Step number={2} title="Configure the server-side GitHub App">
          <p>Set the App slug, App ID, installation-token signing key, and webhook secret using the deployment secret manager. Grant only the repository permissions required by the enabled V19 workflows.</p>
        </Step>
        <Step number={3} title="Install on selected repositories">
          <p>A workspace admin reviews GitHub&apos;s installation screen and selects repositories. V19 records the installation, then verifies scoped read access before showing it as validated.</p>
        </Step>
      </DocSection>

      <DocSection id="gitlab" title="GitLab repository connection and account sign-in" kicker="Limited availability">
        <p>Read-only GitLab repository setup is available only where the workspace feature is enabled. If you see <strong>Manage GitLab</strong> in <Link href="/control/integrations">Control → Integrations</Link>, open it as a workspace owner or admin and select a tracked GitLab repository. If the option is absent, setup is unavailable in that workspace.</p>
        <p>Use <strong>Register project credential</strong> to save the exact project ID, expiry date and approved read-only project credential. Pending registration alone does not enable sync. Use <strong>Verify read access</strong> with the separate verifier in the setup form. Keep tokens out of chat and support requests.</p>
        <p>Once the status is <strong>Read access validated</strong>, the bound repository can sync merge requests, releases and existing pipeline evidence. The connection cannot run GitLab CI or modify a repository. If setup is bound to another repository, select that repository to manage the existing binding.</p>
        <p><strong>Revoke in V19</strong> removes the stored credential and stops V19 sync for that project. Manage the original token separately in GitLab.</p>
        <p>GitLab account sign-in and linking are separate from repository consent. If your sign-in page offers GitLab, using it identifies your account. It does not connect repositories, grant GitLab CI access or authorize actions in a workspace.</p>
      </DocSection>

      <DocSection id="gitlab-status-recovery" title="GitLab setup status and recovery" kicker="Connection readback">
        <p>If GitLab setup says <strong>V19 could not confirm the update</strong>, first check the current connection for the same repository. Use <strong>Refresh status</strong> when the connection panel is visible, or <strong>Refresh GitLab status</strong> if the setup status is unavailable.</p>
        <p>After saving, <strong>Awaiting validation</strong> means you can validate the pending project credential. <strong>Read access validated</strong> means the current repository binding has a valid read check. <strong>Revoked in V19</strong> means V19 stopped using the stored credential. A refresh reads the current status without resending your update. If the status remains unavailable, wait for a fresh result before deciding whether to retry.</p>
      </DocSection>

      <DocSection id="airflow" title="Apache Airflow" kicker="DAGs and run evidence">
        <Step number={1} title="Open the Airflow connection">
          <p>In the desktop app, a workspace administrator opens <strong>Batches → Connection</strong> and uses the secure Airflow connection form.</p>
        </Step>
        <Step number={2} title="Validate the endpoint">
          <p>Use the HTTPS base address of your Airflow 3 deployment and choose username and password or an existing bearer token. Enter credentials only in the connection form. Select <strong>Validate &amp; connect</strong> and wait for V19 to confirm the connection.</p>
        </Step>
        <Step number={3} title="Read the DAG and its run history">
          <p>Choose a DAG to inspect available runs. If validation fails or status is unavailable, check the endpoint and credentials and refresh before relying on the evidence. A validated connection gives no automatic permission to start, retry or schedule a run.</p>
        </Step>
        <p>For Prefect, Dagster and Argo Workflows, see <Link href="/docs/batch-providers" className="underline underline-offset-4">the read-only batch provider guide</Link>.</p>
      </DocSection>

      <DocSection id="slack" title="Slack" kicker="Governed release notifications">
        <p>Implementation review. Customer OAuth and message delivery are not release-verified. The settings below describe operator configuration.</p>
        <Step number={1} title="Register the callback">
          <CodeBlock language="text">{`${ORIGIN}/api/integrations/slack/callback`}</CodeBlock>
        </Step>
        <Step number={2} title="Store the OAuth credentials">
          <CodeBlock language="bash">{`SLACK_CLIENT_ID=<Slack app client ID>
SLACK_CLIENT_SECRET=<secret manager reference>`}</CodeBlock>
        </Step>
        <Step number={3} title="Review least-privilege consent">
          <p>The current workflow requests <code>channels:read</code> and <code>chat:write</code>. It does not request direct messages, private-channel history, commands, or broad message history.</p>
        </Step>
      </DocSection>

      <DocSection id="teams" title="Microsoft tenant / Teams" kicker="Identity validation before messaging">
        <p>The current scope verifies tenant identity. Check your installed version and workspace state before starting consent.</p>
        <Step number={1} title="Register the callback">
          <CodeBlock language="text">{`${ORIGIN}/api/integrations/teams/callback`}</CodeBlock>
        </Step>
        <Step number={2} title="Store tenant OAuth configuration">
          <CodeBlock language="bash">{`MICROSOFT_CLIENT_ID=<application client ID>
MICROSOFT_CLIENT_SECRET=<secret manager reference>
MICROSOFT_TENANT_ID=<approved tenant ID>`}</CodeBlock>
        </Step>
        <Step number={3} title="Validate the boundary">
          <p>The authorization-code flow uses PKCE and currently requests <code>openid</code>, <code>offline_access</code>, and <code>User.Read</code>. This verifies tenant identity; it does not grant Teams messaging authority.</p>
        </Step>
      </DocSection>

      <DocSection id="linear" title="Linear" kicker="Issue context and governed follow-up">
        <p>Planned. There is no verified customer activation path. The settings below describe operator configuration.</p>
        <Step number={1} title="Register the callback">
          <CodeBlock language="text">{`${ORIGIN}/api/integrations/linear/callback`}</CodeBlock>
        </Step>
        <Step number={2} title="Store the OAuth credentials">
          <CodeBlock language="bash">{`LINEAR_CLIENT_ID=<Linear application client ID>
LINEAR_CLIENT_SECRET=<secret manager reference>`}</CodeBlock>
        </Step>
        <Step number={3} title="Review scopes and validate">
          <p>Consent requests <code>read</code> and <code>issues:create</code>. Mutating Agent actions remain separately approval-gated and auditable after the connection is active.</p>
        </Step>
      </DocSection>

      <DocSection id="states" title="Understand connection states">
        <div className="space-y-3 text-sm text-zinc-300">
          <p><strong>Setup required:</strong> the service is missing an OAuth registration, trusted callback origin, or production secret. A workspace user cannot fix this in the desktop app.</p>
          <p><strong>Awaiting validation:</strong> provider consent returned successfully, but V19 has not yet completed a live server-side check.</p>
          <p><strong>Active / validated read-only:</strong> the scoped provider token or GitHub installation passed live validation.</p>
          <p><strong>Needs attention / validation overdue:</strong> validation failed or is stale. Revalidate before relying on the connection for release evidence.</p>
        </div>
        <Callout variant="warning">
          Never paste a client secret into Agent chat or a repository file. If a secret was exposed, revoke it at the provider, rotate it in the secret manager, and review the V19 audit trail before reconnecting.
        </Callout>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/desktop-architecture", label: "Desktop architecture" }}
        next={{ href: "/docs/security-model", label: "Security model" }}
      />
      <DocFeedback />
    </article>
  );
}
