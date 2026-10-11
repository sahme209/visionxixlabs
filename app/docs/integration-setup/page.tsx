import type { Metadata } from "next";
import { Callout, CodeBlock, DocFeedback, DocFooterNav, DocHeader, DocSection, Step } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Release integration setup — Axiom Documentation",
  description: "Securely activate GitHub, Slack, Microsoft Teams, and Linear for the Axiom desktop application.",
};

const ORIGIN = "https://visionxixlabs.com";

export default function IntegrationSetupPage() {
  return (
    <article className="docs-prose">
      <DocHeader
        kicker="Connections"
        title="Activate release integrations"
        summary="Axiom opens provider consent with one click, but the service operator must register each OAuth application first. Provider secrets remain in the production secret manager and are never entered into the desktop app."
      />

      <Callout variant="safe" title="Two separate responsibilities">
        The <strong>service operator</strong> registers the OAuth application, exact callback URL, and server-side secret once. A <strong>workspace owner or admin</strong> then clicks Connect, reviews the provider consent screen, selects the intended workspace, and returns to Axiom for live validation.
      </Callout>

      <DocSection id="shared" title="Before connecting a provider" kicker="Service operator checklist">
        <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-300">
          <li>Set the production Axiom origin as <code>NEXTAUTH_URL</code>; callback construction fails closed when the origin is not trusted.</li>
          <li>Register the exact HTTPS callback shown below. Wildcard callback domains are not supported.</li>
          <li>Store client secrets only in the hosting platform&apos;s encrypted secret manager—never in <code>NEXT_PUBLIC_*</code>, the desktop app, logs, or Git.</li>
          <li>Redeploy the service after adding credentials, then use Plugins &amp; Skills or Settings → Integrations to start consent.</li>
          <li>Run the harmless validation step. Axiom does not label a connection active from consent alone.</li>
        </ol>
      </DocSection>

      <DocSection id="github" title="GitHub App" kicker="Repository-scoped code and release evidence">
        <Step number={1} title="Register the installation callback">
          <CodeBlock language="text">{`${ORIGIN}/api/integrations/github/install-callback`}</CodeBlock>
        </Step>
        <Step number={2} title="Configure the server-side GitHub App">
          <p>Set the App slug, App ID, installation-token signing key, and webhook secret using the deployment secret manager. Grant only the repository permissions required by the enabled Axiom workflows.</p>
        </Step>
        <Step number={3} title="Install on selected repositories">
          <p>A workspace admin reviews GitHub&apos;s installation screen and selects repositories. Axiom records the installation, then verifies scoped read access before showing it as validated.</p>
        </Step>
      </DocSection>

      <DocSection id="slack" title="Slack" kicker="Governed release notifications">
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
          <p><strong>Awaiting validation:</strong> provider consent returned successfully, but Axiom has not yet completed a live server-side check.</p>
          <p><strong>Active / validated read-only:</strong> the scoped provider token or GitHub installation passed live validation.</p>
          <p><strong>Needs attention / validation overdue:</strong> validation failed or is stale. Revalidate before relying on the connection for release evidence.</p>
        </div>
        <Callout variant="warning">
          Never paste a client secret into Agent chat or a repository file. If a secret was exposed, revoke it at the provider, rotate it in the secret manager, and review the Axiom audit trail before reconnecting.
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
