import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { IntegrationCatalogBrowser } from "@/components/marketing/IntegrationCatalogBrowser";
import { publicCatalogEntries } from "@/lib/integrations/publicIntegrationCatalog";
import { PipeFlow } from "@/components/marketing/pipeKit/PipeFlow";
import { INTEGRATION_FLOW_STAGES } from "@/lib/marketing/integrationFlowModel";
import { IntegrationConnectionsScene } from "@/components/marketing/IntegrationConnectionsScene";

export const dynamic = "force-dynamic";
export default function IntegrationsCatalog(){
 const entries=publicCatalogEntries();
 return <div className="axiom-canvas min-h-screen text-zinc-100"><Navigation/><main className="public-catalog-page integration-editorial-page">
  <header className="integration-editorial-intro"><p>Connections, with context.</p><h1>Your tools.<br/><span>One clear workflow.</span></h1><p>Bring repository context, cloud evidence and operational signals into Axiom. Choose the job, check the limits, then follow the setup.</p><Link href="/docs/integration-setup" className="orbit-primary">Read the connection guide <span aria-hidden="true">↗</span></Link></header>
  <section aria-labelledby="connection-catalog" className="public-catalog-section">
   <div className="integration-section-heading"><h2 id="connection-catalog">Find your connection.</h2><p>Availability belongs to each workflow. Browsing starts nothing.</p></div>
   <IntegrationCatalogBrowser entries={entries}/>
  </section>
  <section aria-labelledby="integration-setup" className="integration-editorial-pair">
   <div><p className="integration-eyebrow">A deliberate connection</p><h2 id="integration-setup">Start with the job.<br/><span>Keep access specific.</span></h2><p>Choose a supported workflow before connecting an account. Its setup guide explains the provider, workspace and permissions it needs.</p><Link href="/docs/permissions-model">Explore the permission model <span aria-hidden="true">↗</span></Link></div>
   <div className="integration-setup-study" aria-label="Illustrative connection checklist"><p>Connection checklist <span>Illustration</span></p><ol><li><span>01</span><div><strong>Choose the workflow</strong><p>Check availability and operation limits.</p></div></li><li><span>02</span><div><strong>Scope the account</strong><p>Confirm the provider and intended workspace.</p></div></li><li><span>03</span><div><strong>Verify readiness</strong><p>Review current access before proceeding.</p></div></li></ol><p>No account is connected in this illustration.</p></div>
  </section>
  <section aria-labelledby="integration-flow" className="public-flow-section"><h2 id="integration-flow" className="text-xl font-medium tracking-tight">How a connection is used</h2><p className="mt-3 max-w-3xl text-[15px] leading-7 text-zinc-400">Five separate checks, from choosing a workflow to a recorded outcome. Browsing runs none of them.</p><div className="mt-6"><PipeFlow stages={INTEGRATION_FLOW_STAGES} label="How a connection is used" /></div></section>
  <section aria-labelledby="integration-landscape" className="integration-landscape"><div><p className="integration-eyebrow">Across your workflow</p><h2 id="integration-landscape">Different tools.<br/><span>A shared place for context.</span></h2><p>Explore the catalog from source to operations. Preview, review and planned entries appear alongside available workflows; their limits stay visible above.</p></div><IntegrationConnectionsScene entries={entries}/><p className="integration-trademark-note">Logos are trademarks of their owners and do not imply endorsement. Visual Studio Code uses a generic editor symbol.</p></section>
  <section aria-labelledby="integration-questions" className="integration-faq"><h2 id="integration-questions">A few things to know.</h2><div>{[
   ["Does browsing connect my account?", "No. This catalog starts no connection, grants no permission and performs no provider action. Follow the setup guide for the connection you choose."],
   ["What does available mean?", "A released workflow exists. Current account access, configuration and operation checks are still required. A connection is not permission for every action."],
   ["What does configuration required mean?", "Connection code is implemented, but your account configuration and live validation are still required. Open Connection details for its exact limits."],
   ["Can I use preview or planned integrations?", "Preview and implementation-review entries have incomplete release verification; read their individual limits. Planned entries offer no customer setup here."],
   ["Can a connection run a production change?", "Readiness, review and execution are separate checks. Governance remains incomplete and disabled; a catalog entry cannot approve or enable production execution."],
   ["Where do I check permissions?", "Start with the connection’s setup guide and the permission model. Confirm the exact provider, workspace and operation before granting access."]
  ].map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
  <aside className="max-w-3xl border-t border-white/10 pt-6"><h2 className="text-base font-medium text-zinc-100">Before you connect</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Check the real setup and permission requirements. Readiness, review and execution are separate checks; browsing cannot approve or run a change.</p><div className="mt-4 flex flex-wrap gap-5 text-sm text-zinc-300"><Link href="/docs/integration-setup">Connection guide →</Link><Link href="/docs/permissions-model">Permission model →</Link><Link href="/download">Desktop downloads →</Link></div></aside>
 </main><Footer/></div>;
}
