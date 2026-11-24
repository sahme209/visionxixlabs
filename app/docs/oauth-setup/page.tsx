import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Step, Callout, CodeBlock, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "OAuth setup (Google + GitHub) — V19 Documentation",
  description:
    "Enable Google and GitHub sign-in for your V19 deployment by configuring NextAuth providers + host environment variables.",
};

export default function OAuthSetupPage() {
  return (
    <article className="docs-prose">
      <DocHeader
        kicker="Authentication"
        title="Enable Google + GitHub sign-in"
        summary="V19 uses NextAuth. Google and GitHub sign-in options appear when the browser confirms that the host registered those providers."
      />

      <DocSection id="overview" title="Overview" kicker="Three things to configure for each provider">
        <ol className="list-decimal list-inside space-y-1 text-zinc-300 text-sm">
          <li>Create an OAuth application with the provider (Google Cloud Console / GitHub OAuth Apps).</li>
          <li>Register the callback URL pointing at your V19 host.</li>
          <li>Set the resulting Client ID + Client Secret on your host as environment variables.</li>
        </ol>
        <Callout variant="info">
          The sign-in page checks <span className="font-mono">/api/auth/providers</span> on load. A provider
          appears only when that response includes it. The appearance of a sign-in option confirms
          registration. Verify that the callback succeeds with a test account.
        </Callout>
      </DocSection>

      <DocSection id="host-base" title="1. Base NextAuth env" kicker="Required for every deployment regardless of provider">
        <CodeBlock language="bash">{`# Required for every deployment
NEXTAUTH_URL=https://your-domain.example.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
`}</CodeBlock>
        <p className="text-sm text-zinc-400">
          <code className="text-orange-300">NEXTAUTH_URL</code> must exactly match the public origin (no trailing
          slash). On Vercel set it under Project → Settings → Environment Variables for Production +
          Preview environments.
        </p>
      </DocSection>

      <DocSection id="google" title="2. Google sign-in">
        <Step number={1} title="Create an OAuth client">
          <p>
            Open the{" "}
            <a className="text-orange-300 underline underline-offset-2" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
              Google Cloud Console → APIs & Services → Credentials
            </a>
            . Click <strong>Create Credentials → OAuth client ID → Web application</strong>.
          </p>
        </Step>
        <Step number={2} title="Add the authorized redirect URI">
          <p>Under <strong>Authorized redirect URIs</strong>, add:</p>
          <CodeBlock language="text">{`https://your-domain.example.com/api/auth/callback/google`}</CodeBlock>
          <p className="text-sm text-zinc-400">
            For local development add <code className="wrap-anywhere text-orange-300">http://localhost:3000/api/auth/callback/google</code> as well.
          </p>
        </Step>
        <Step number={3} title="Copy the credentials">
          <p>Google shows a Client ID + Client Secret. Treat the secret as you would an API key.</p>
        </Step>
        <Step number={4} title="Set env on the host">
          <CodeBlock language="bash">{`GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxx`}</CodeBlock>
        </Step>
        <Callout variant="warning">
          Google&apos;s OAuth consent screen needs at least one scope (<code>openid email profile</code> is
          the NextAuth default). For external apps you&apos;ll need to publish the consent screen to leave
          test mode and accept non-test users.
        </Callout>
      </DocSection>

      <DocSection id="github" title="3. GitHub sign-in">
        <Step number={1} title="Create an OAuth app">
          <p>
            Open{" "}
            <a className="text-orange-300 underline underline-offset-2" href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer">
              GitHub → Settings → Developer settings → OAuth Apps
            </a>{" "}
            and click <strong>New OAuth App</strong>.
          </p>
        </Step>
        <Step number={2} title="Set the callback URL">
          <p>
            Homepage URL: <code>https://your-domain.example.com</code>
          </p>
          <p>Authorization callback URL:</p>
          <CodeBlock language="text">{`https://your-domain.example.com/api/auth/callback/github`}</CodeBlock>
        </Step>
        <Step number={3} title="Generate a client secret">
          <p>
            After saving, click <strong>Generate a new client secret</strong>. GitHub shows the secret
            once — copy it immediately.
          </p>
        </Step>
        <Step number={4} title="Set env on the host">
          <CodeBlock language="bash">{`GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=ghp_xxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
        </Step>
        <Callout variant="info">
          For an organization-restricted app, create the OAuth app under the org&apos;s settings and
          enable the SSO requirement so only org members can sign in.
        </Callout>
      </DocSection>

      <DocSection id="verify" title="4. Verify it works">
        <ol className="list-decimal list-inside space-y-1 text-zinc-300 text-sm">
          <li>Redeploy after setting the env vars (env changes don&apos;t auto-rebuild on most hosts).</li>
          <li>Open the sign-in page in an incognito window.</li>
          <li>Confirm the configured options appear. GitHub appears below email sign-in.</li>
          <li>Complete the provider flow and confirm that the browser returns to V19 Control or the page that requested sign-in.</li>
          <li>To connect the installed app, <Link href="/docs/desktop-install" className="text-orange-300 underline underline-offset-2">complete desktop pairing</Link> and approve the requested connection.</li>
        </ol>
        <Callout variant="warning">
          If you see <code>error=Configuration</code> after the OAuth round-trip, check the host configuration,
          provider credentials, and registered callback URL.
        </Callout>
      </DocSection>

      <DocSection id="troubleshooting" title="Troubleshooting">
        <div className="space-y-3 text-sm text-zinc-300">
          <div>
            <p className="font-semibold text-white">A provider option is missing</p>
            <p className="text-zinc-400">Check whether the host has both credentials for that provider, then verify that the provider appears in the sign-in page&apos;s provider response.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Redirect URI mismatch</p>
            <p className="text-zinc-400">
              The exact callback URL registered with the provider must match the one NextAuth requests.
              For a preview deployment, configure that exact callback URL with the provider or
              restrict OAuth sign-in to your configured production origin.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Works locally but not in production</p>
            <p className="text-zinc-400">
              <code className="text-orange-300">NEXTAUTH_URL</code> not set or doesn&apos;t match the production
              origin. NextAuth uses this to construct callback URLs.
            </p>
          </div>
        </div>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/security-model", label: "Security model" }}
        next={{ href: "/docs/permissions-model", label: "Permissions model" }}
      />
      <DocFeedback />
      <p className="mt-6 text-[11px] text-zinc-400">
        Need help? <Link href="/contact?topic=security" className="text-orange-300 hover:text-orange-200">Open a security review request</Link>.
      </p>
    </article>
  );
}
