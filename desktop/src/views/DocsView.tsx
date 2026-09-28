/**
 * DocsView — Phase 406-desktop.
 *
 * Curated index of the web documentation. Every link opens the
 * authoritative web doc in a new browser tab — the desktop intentionally
 * doesn't embed an in-app markdown reader, because docs benefit from
 * search, browser back/forward, and link sharing.
 */

import { Card, ExternalLink, ViewShell } from "../components/Primitives";

interface DocLink {
  title: string;
  body: string;
  href: string;
}

const DOCS: ReadonlyArray<{ section: string; links: DocLink[] }> = [
  {
    section: "Getting started",
    links: [
      { title: "Product documentation", body: "Installed application overview and operating model.", href: "https://visionxixlabs.com/docs" },
      { title: "Getting started", body: "Install, authenticate, and create the first deployment request.", href: "https://visionxixlabs.com/docs/getting-started" },
      { title: "Permissions model", body: "Approval, merge, execution, and environment authority boundaries.", href: "https://visionxixlabs.com/docs/permissions-model" },
    ],
  },
  {
    section: "Deployment operations",
    links: [
      { title: "Approval workflow", body: "Human gates and separation of duties.", href: "https://visionxixlabs.com/docs/approval-workflow" },
      { title: "Glossary", body: "Deployment and governance terminology.", href: "https://visionxixlabs.com/docs/glossary" },
    ],
  },
  {
    section: "Troubleshooting",
    links: [
      { title: "Troubleshooting",  body: "Common errors + remediations.",        href: "https://visionxixlabs.com/docs/troubleshooting" },
      { title: "Surfaces",         body: "Where each piece of data is rendered.", href: "https://visionxixlabs.com/docs/surfaces" },
    ],
  },
];

export function DocsView() {
  return (
    <ViewShell>
      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">workspace · documentation</p>
        <h1 className="text-2xl font-bold tracking-tight">Documentation</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          The complete documentation lives on the web at{" "}
          <span className="font-mono text-zinc-400">visionxixlabs.com/docs</span>. Each link below
          opens the authoritative version in your browser.
        </p>
      </div>

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
