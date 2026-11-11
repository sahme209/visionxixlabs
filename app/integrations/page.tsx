import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { IntegrationCatalogBrowser } from "@/components/marketing/IntegrationCatalogBrowser";
import { publicCatalogEntries } from "@/lib/integrations/publicIntegrationCatalog";
import { PipeFlow } from "@/components/marketing/pipeKit/PipeFlow";
import { INTEGRATION_FLOW_STAGES } from "@/lib/marketing/integrationFlowModel";
import { PageHero } from "@/components/marketing/PageHero";
import { IntegrationsHubFlow } from "@/components/marketing/IntegrationsHubFlow";
export const dynamic = "force-dynamic";
export default function IntegrationsCatalog(){
 const entries=publicCatalogEntries();
 return <div className="min-h-screen bg-[#101010] text-zinc-100"><Navigation/><main className="mx-auto max-w-[1280px] space-y-10 px-5 pb-20 pt-24 sm:px-8 lg:px-10 lg:pt-28">
  <PageHero eyebrow="Axiom · Integrations" title="Find the right connection for the job." lead="Browse supported workflows, previews and planned connections. Check each operation and its limits before you configure anything." note="This public catalog starts no connection, grants no permission and performs no provider action." />
  <IntegrationsHubFlow />
  <section aria-labelledby="integration-flow"><h2 id="integration-flow" className="text-xl font-medium tracking-tight">How a connection is used</h2><p className="mt-3 max-w-3xl text-[15px] leading-7 text-zinc-400">Five separate checks, from choosing a workflow to a recorded outcome. Browsing runs none of them.</p><div className="mt-6"><PipeFlow stages={INTEGRATION_FLOW_STAGES} label="How a connection is used" /></div></section>
  <IntegrationCatalogBrowser entries={entries}/>
  <details className="max-w-3xl rounded-xl border border-white/10 p-5 text-sm leading-6 text-zinc-400"><summary className="cursor-pointer font-medium text-zinc-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-orange-300">How to read availability</summary><dl className="mt-4 space-y-3"><div><dt className="font-medium text-zinc-200">Available workflows</dt><dd>Still needs current account access, configuration and operation checks in Axiom.</dd></div><div><dt className="font-medium text-zinc-200">Configuration required</dt><dd>Connector code exists; your configuration is still required.</dd></div><div><dt className="font-medium text-zinc-200">Preview or implementation review</dt><dd>Adapter code exists; the released customer journey is not fully verified.</dd></div><div><dt className="font-medium text-zinc-200">Planned</dt><dd>No customer setup is offered here. A catalog entry is not an available connection.</dd></div></dl></details>
  <aside className="max-w-3xl border-t border-white/10 pt-6"><h2 className="text-base font-medium text-zinc-100">Before you connect</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Check the real setup and permission requirements. Readiness, review and execution are separate checks; browsing cannot approve or run a change.</p><div className="mt-4 flex flex-wrap gap-5 text-sm text-zinc-300"><Link href="/docs/integration-setup">Connection guide →</Link><Link href="/docs/permissions-model">Permission model →</Link><Link href="/download">Desktop downloads →</Link></div></aside>
 </main><Footer/></div>;
}
