import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Security model — Axiom Documentation",
  description: "Current Axiom authentication, connector, tenant, secret, audit, and assurance controls and limitations.",
};

export default function SecurityModelPage() {
  return (
    <>
      <DocHeader
        kicker="Trust & security"
        title="The current Axiom security model."
        summary="Implemented product controls are described separately from configuration requirements, unverified deployment behavior, independent certification, and customer obligations."
      />

      <Callout variant="warning" title="Current release boundary">
        AWS uses an assume-role design when configured. Azure and GCP live SDK validation are not released, OS-keychain-backed desktop persistence is pending, and local infrastructure apply is disabled. Current desktop-v0.1.7 installers are not attested as signed or notarized.
      </Callout>

      <DocSection id="authentication" title="Desktop authentication" kicker="01 · Identity">
        <p>The installed application uses a browser approval handoff and scoped application session. The website is not a customer sign-in product. A packaged PKCE, expiry, logout, replay, recovery, and OS-keychain journey still requires exact-build verification.</p>
      </DocSection>

      <DocSection id="connectors" title="Connector permissions" kicker="02 · Providers">
        <p>A connector&apos;s code status is not its live availability status. AWS connection logic requires service and customer configuration. Azure and GCP currently provide format validation and preview analysis. Generated Terraform and CLI artifacts remain review-only.</p>
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

      <DocFooterNav prev={{ href: "/docs/aws-setup", label: "AWS setup" }} next={{ href: "/docs/troubleshooting", label: "Troubleshooting" }} />
      <DocFeedback />
    </>
  );
}
