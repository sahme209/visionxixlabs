import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "API keys — V19 Documentation",
 description: "Create and revoke scoped, expiring workspace API keys for agents and CI.",
 alternates: { canonical: "/docs/api-keys" },
};
export default function ApiKeysDocsPage() {
 return <>
  <DocHeader kicker="Workspace · Security" title="Create a scoped, expiring key."
   summary="Owners and admins manage keys on Control → API keys. Keys are limited to governance and read scopes." />
  <DocFigure src="/docs/cockpit/api-keys.webp" alt="The API keys page in the V19 cockpit in a browser" caption="API keys in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
  <DocSection id="create" kicker="01" title="Create a key">
   <p>Name the key, choose its permissions and choose when it expires (7 to 90 days). Available permissions: request approvals and report outcomes, check policy and read approval status, read pipeline runs, read the release gate, read webhook endpoints. Wildcard, trigger and admin permissions are not available here.</p>
   <Callout variant="warning" title="Copy it once">The full key is shown once. V19 stores only a hash and a short prefix, so it cannot show the key again.</Callout>
  </DocSection>
  <DocSection id="duties" kicker="02" title="Separation of duties">
   <p>The person who creates a key is recorded and cannot approve agent gateway requests made with that key. Another owner or admin must decide them.</p>
  </DocSection>
  <DocSection id="revoke" kicker="03" title="Revoke a key">
   <p>Revoke a key from the list as soon as it may have been exposed or is no longer needed. Revocation takes effect immediately and is recorded in the audit log. A workspace can hold up to 20 active keys.</p>
  </DocSection>
  <DocSection id="ci" kicker="04" title="Use a key in CI">
   <p>Two endpoints are built for pipelines. With <em>read pipeline runs</em>, <code>GET /api/v1/environments/{"{slug}"}/variables</code> returns an environment&apos;s resolved configuration and its fingerprint, so a deployment can load its settings and record which configuration it used. With <em>request approvals and report outcomes</em>, <code>POST /api/v1/checks/results</code> records the result of a deployment check for a commit; the workflow generated on the Checks page uses it when the repository has a <code>V19_API_KEY</code> secret.</p>
   <p>Store the key as a repository secret, give it only the permissions those calls need, and choose a short expiry. API calls also require an active paid plan for the workspace. Every SDK has matching methods.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/trust-tools",label:"Trust tools"}} next={{href:"/docs/troubleshooting",label:"Troubleshooting"}} />
 </>;
}
