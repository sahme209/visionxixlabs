import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Trust tools — Axiom Documentation",
 description: "Seal and verify the audit log, replay a draft rule over real history, and preview a change's impact before approving it.",
 alternates: { canonical: "/docs/trust-tools" },
};
export default function TrustToolsDocsPage() {
 return <>
  <DocHeader kicker="Security · Governance" title="Prove, replay, preview."
   summary="Three read-only tools on Control → Trust tools. Each states its limits." />
  <DocSection id="seal" kicker="01" title="Seal and verify the audit log">
   <p>Owners and admins seal recent audit events. Each seal fingerprints a window of events and links to the previous seal, forming a chain. Anyone in the workspace can verify: the result is intact, or names the seal whose events changed or whose link broke.</p>
   <Callout variant="warning" title="Evidence, not prevention">Sealing does not stop someone from changing data; it makes the change visible. Store the latest seal fingerprint outside Axiom so a rewritten chain is also detectable.</Callout>
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
