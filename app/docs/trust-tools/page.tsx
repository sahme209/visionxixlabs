import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Trust tools — V19 Documentation",
 description: "Seal and verify the audit log, replay a draft rule over real history, and preview a change's impact before approving it.",
 alternates: { canonical: "/docs/trust-tools" },
};
export default function TrustToolsDocsPage() {
 return <>
  <DocHeader kicker="Security · Governance" title="Prove, replay, preview."
   summary="Three read-only tools on Control → Trust tools. Each states its limits." />
  <DocFigure src="/docs/cockpit/trust-tools.webp" alt="The Trust tools page in the V19 cockpit in a browser" caption="Trust tools in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
  <DocSection id="seal" kicker="01" title="Seal and verify the audit log">
   <p>Owners and admins seal recent audit events. Each seal fingerprints a window of events and links to the previous seal, forming a chain. Anyone in the workspace can verify: the result is intact, or names the seal whose events changed or whose link broke.</p>
   <p>Because someone who can rewrite the database could also rebuild the chain, download an <em>anchor</em> after sealing and keep it somewhere V19 cannot write, such as a ticket, a vault or an email to your auditors. The anchor holds the latest seal&apos;s fingerprint and no event content. Later, choose <em>Check a kept anchor</em>: V19 reports whether that seal still matches, is missing or was rewritten, and refuses an anchor file that was edited or belongs to another workspace.</p>
   <Callout variant="warning" title="Evidence, not prevention">Sealing does not stop someone from changing data; it makes the change visible. Store the latest seal fingerprint outside V19 so a rewritten chain is also detectable.</Callout>
  </DocSection>
  <DocSection id="replay" kicker="02" title="Replay a draft rule">
   <p>Pick a draft rule and replay it over up to 90 days of real approval history, through the same rule engine production uses. You see how many actions it would newly block or auto-approve, and each changed action. Nothing is enabled or saved.</p>
   <p>History does not store a finding category, so rules that match on category are skipped and named rather than guessed.</p>
  </DocSection>
  <DocSection id="impact" kicker="03" title="Preview a change">
   <p>Paste the changed file paths. The preview lists the areas touched (migrations, CI, auth, infrastructure, dependencies, secrets, API, frontend, tests, docs), the blast radius, whether a rollback plan is needed, and what a reviewer should check. It reads file names only, never contents.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/agent-gateway",label:"Agent gateway"}} next={{href:"/docs/api-keys",label:"API keys"}} />
 </>;
}
