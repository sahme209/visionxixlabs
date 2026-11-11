/**
 * DocsView — Phase 406-desktop.
 *
 * Curated index of the web documentation. Every link opens the
 * web doc in a new browser tab — the desktop intentionally
 * doesn't embed an in-app markdown reader, because docs benefit from
 * search, browser back/forward, and link sharing.
 */

import { Card, ExternalLink, ViewShell } from "../components/Primitives";
import { GOVERNED_JOURNEY, GOVERNED_JOURNEY_AVAILABILITY, type GovernedJourneyDestination } from "../../../lib/desktop/governedJourney";

interface DocLink {
  id: string;
  title: string;
  body: string;
  href: string;
}

const DOCS: ReadonlyArray<{ section: string; links: DocLink[] }> = [
  {
    section: "Getting started",
    links: [
      { id: "overview", title: "Product documentation", body: "Installed application overview and operating model.", href: "https://visionxixlabs.com/docs" },
      { id: "getting-started", title: "Getting started", body: "Install, authenticate, and create the first deployment request.", href: "https://visionxixlabs.com/docs/getting-started" },
      { id: "permissions", title: "Permissions model", body: "Approval, merge, execution, and environment authority boundaries.", href: "https://visionxixlabs.com/docs/permissions-model" },
    ],
  },
  {
    section: "Deployment operations",
    links: [
      { id: "approvals", title: "Approval workflow", body: "Human gates and separation of duties.", href: "https://visionxixlabs.com/docs/approval-workflow" },
      { id: "glossary", title: "Glossary", body: "Deployment and governance terminology.", href: "https://visionxixlabs.com/docs/glossary" },
    ],
  },
  {
    section: "Troubleshooting",
    links: [
      { id: "troubleshooting", title: "Troubleshooting",  body: "Common errors + remediations.",        href: "https://visionxixlabs.com/docs/troubleshooting" },
      { id: "surfaces", title: "Surfaces",         body: "Where each piece of data is rendered.", href: "https://visionxixlabs.com/docs/surfaces" },
    ],
  },
];

export function DocsView({ onNavigate }: { onNavigate: (view: GovernedJourneyDestination) => void }) {
  return (
    <ViewShell>
      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">workspace · documentation</p>
        <h1 className="text-2xl font-bold tracking-tight">Documentation</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Read task guides on the web at{" "}
          <span className="font-mono text-zinc-400">visionxixlabs.com/docs</span>. These links open
          web documentation in your browser. Check the installed version and stated availability
          before following a guide.
        </p>
      </div>

      <section aria-labelledby="governed-journey-title">
        <h2 id="governed-journey-title" className="text-lg font-semibold text-white">From code to governed deployment</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{GOVERNED_JOURNEY_AVAILABILITY}</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {GOVERNED_JOURNEY.map(stage => (
            <li key={stage.id}>
              <Card className="h-full p-4">
                <h3 className="text-sm font-semibold text-white">{stage.title}</h3>
                <p className="mt-2 text-xs leading-6 text-zinc-400">{stage.detail}</p>
                <button type="button" data-help-id={`documentation.journey.${stage.id}`} onClick={() => onNavigate(stage.destination)} className="mt-3 rounded-md border border-white/15 px-3 py-2 text-xs text-orange-200 hover:bg-white/5 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-orange-300">{stage.cta}</button>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-5">
        {DOCS.map((sec) => (
          <section key={sec.section}>
            <h2 className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.22em] mb-2">
              {sec.section}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sec.links.map((link) => (
                <ExternalLink
                  key={link.href}
                  href={link.href}
                  data-help-id={`documentation.web.${link.id}`}
                  className="block group"
                >
                  <Card className="p-3 hover:border-violet-500/30 transition-colors">
                    <p className="text-[13px] font-semibold text-white group-hover:text-violet-200 transition-colors">
                      {link.title} <span aria-hidden className="text-zinc-600 group-hover:text-violet-300">↗</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{link.body}</p>
                  </Card>
                </ExternalLink>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ViewShell>
  );
}
