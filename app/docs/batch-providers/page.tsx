import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Batch providers — Axiom Documentation",
 description: "Connect Prefect, Dagster or Argo Workflows read-only so the Agent can inspect flows, jobs and runs.",
 alternates: { canonical: "/docs/batch-providers" },
};
export default function BatchProvidersDocsPage() {
 return <>
  <DocHeader kicker="Integrations · Batches" title="Prefect, Dagster and Argo, read-only."
   summary="Connect a batch orchestrator so the Agent can explain flows, jobs and runs. It cannot start, retry or cancel anything." />
  <Callout title="Availability">Read-only clients and the desktop connection form are built. Live acceptance with real Prefect, Dagster and Argo accounts is still pending. Airflow remains the existing provider with its own automation features.</Callout>
  <DocSection id="connect" kicker="01" title="Connect a provider">
   <p>In the desktop app open <strong>Batches → Connection</strong>. Under <strong>More batch providers</strong>, enter the API URL and a token. Argo Workflows also needs the one namespace to read. Choose <strong>Connect read-only</strong>.</p>
   <p>Axiom validates the token with one small read, then stores it encrypted for your workspace. The token is never shown again or sent back to the app.</p>
  </DocSection>
  <DocSection id="urls" kicker="02" title="Accepted addresses">
   <dl className="space-y-4">
    <div><dt className="font-semibold text-white">Prefect</dt><dd>Prefect Cloud <code>https://api.prefect.cloud/api/accounts/…/workspaces/…</code>, or a self-hosted <code>https://…/api</code>.</dd></div>
    <div><dt className="font-semibold text-white">Dagster</dt><dd>Dagster+ <code>https://your-org.dagster.cloud/deployment</code>, or a self-hosted root.</dd></div>
    <div><dt className="font-semibold text-white">Argo Workflows</dt><dd>The Argo Server address (HTTPS) and one namespace. In-cluster and private addresses are refused.</dd></div>
   </dl>
  </DocSection>
  <DocSection id="agent" kicker="03" title="What the Agent can read">
   <p>The Automation Agent and the Batches diagnostics skill can list flows, jobs and templates and read recent runs and task runs, up to 20 entries from the first page. Results are observation only and labelled as incomplete coverage. Logs, parameters, artifacts and secrets are never read.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/integration-setup",label:"Integration setup"}} next={{href:"/docs/ask-axiom",label:"Ask Axiom"}} />
 </>;
}
