import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
import { ArchitectureMap } from "@/components/docs/ArchitectureMap";

export const metadata: Metadata = {
  title: "Security model — V19 Documentation",
  description: "Current V19 authentication, connector, tenant, secret, audit, and assurance controls and limitations.",
};

export default function SecurityModelPage() {
  return (
    <>
      <DocHeader
        kicker="Trust & security"
        title="The current V19 security model."
        summary="Implemented product controls are described separately from configuration requirements, unverified deployment behavior, independent certification, and customer obligations."
      />

      <Callout variant="warning" title="Current release boundary">
        The released AWS ECS path dispatches a tenant-owned GitHub Actions workflow and uses OIDC to assume the configured role. Azure and GCP deployment paths are not released, enterprise identity is configuration-only, and local infrastructure apply is disabled. Verify the signing and notarization status shown on the download page for the exact installer you use.
      </Callout>

      <ArchitectureMap />

      <DocFigure src="/docs/cockpit/audit-security.webp" alt="The Audit and security page in the V19 cockpit" caption="Audit & security in the cockpit, shown for a new synthetic workspace." width={1600} height={1000} />
      <DocSection id="authentication" title="Desktop authentication" kicker="01 · Identity">
        <p>The installed application uses a browser approval handoff and scoped application session. The website is not a customer sign-in product. A packaged PKCE, expiry, logout, replay, recovery, and OS-keychain journey still requires exact-build verification.</p>
      </DocSection>

      <DocSection id="connectors" title="Connector permissions" kicker="02 · Providers">
        <p>A connector&apos;s code status is not its live availability status. GitHub access is installation- and repository-scoped. AWS ECS deployment requires a configured environment target, tenant workflow, and OIDC role. Azure and GCP production deployment paths are not released.</p>
        <p>Repository visibility, pull-request approval, merge authority, workflow dispatch, environment approval, release publication, and change management are distinct permissions. Each server-side action must enforce its own authorization.</p>
      </DocSection>

      <DocSection id="secrets" title="Secret handling" kicker="03 · Data handling">
        <p>Secret-redaction utilities protect supported contact, logging, and operational paths. They do not prove that every field, connector, backup, export, or third-party system is safe for confidential data. Operators must use tenant policy and provider-specific credential guidance.</p>
      </DocSection>

      <DocSection id="tenants" title="Tenant boundaries" kicker="04 · Isolation">
        <p>Organization identifiers and tenant checks exist across core repositories and services. “Tenant isolated” is not treated as globally verified until every query, cache, background job, export, backup, restore, and administrator path has been exercised against a configured deployment.</p>
      </DocSection>

      <DocSection id="audit" title="Audit and evidence" kicker="05 · Evidence">
        <p>Supported workflows can record actor, action, rationale, timestamp, and outcome data. Hash and export utilities exist, but coverage varies by workflow. An audit record is product evidence; it is not an independent auditor&apos;s attestation or proof that a customer is compliant.</p>
      </DocSection>

      <DocSection id="retention" title="Retention, deletion, and recovery" kicker="06 · Lifecycle">
        <p>Consistent customer-configurable retention, deletion, backup, and restore behavior is not yet verified across every store. Do not rely on an informal retention period or deletion promise; confirm the configured deployment and record the result in the verification report.</p>
      </DocSection>

      <DocSection id="compliance" title="Compliance posture" kicker="07 · Assurance">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>No SOC 2, ISO 27001, HIPAA, or other independent certification is currently claimed.</li>
          <li>Control-mapping code is a product feature, not a certification or active audit.</li>
          <li>No BAA, DPA, data-residency, SSO entitlement, or commercial tier is promised without approved documentation.</li>
          <li>Customers remain responsible for their own legal, risk, and compliance decisions.</li>
        </ul>
      </DocSection>

      <DocSection id="self-hosted" title="Run V19 on your own servers (preview)" kicker="08 · Deployment">
        <p>The repository includes a self-hosted kit in <code>deploy/self-hosted</code>: a container image for the web app and API, PostgreSQL, a one-time database migration step and an optional local AI service (Ollama). Copy <code>.env.example</code> to <code>.env</code>, set a database password, the public address and two long random secrets, then run <code>docker compose up -d --build</code>. The app listens on port 3000 on the host; put your own TLS reverse proxy in front of it. Use the cockpit and the Agent service through the browser; the desktop app currently connects only to visionxixlabs.com.</p>
        <p>For an environment without internet access, build the image where you have access, move it with <code>docker save</code> and <code>docker load</code>, and use the local AI profile so no model provider is contacted. Connectors to cloud services (GitHub, AWS and others) still need network access to those services. This is a preview: sign-in providers, email, billing and backups are yours to configure, and a deployment-specific security review is still needed.</p>
      </DocSection>

      <DocFooterNav prev={{ href: "/docs/aws-setup", label: "AWS setup" }} next={{ href: "/docs/troubleshooting", label: "Troubleshooting" }} />
      <DocFeedback />
    </>
  );
}
