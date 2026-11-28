import Link from "next/link";

/**
 * "Inside V19": real screens from the desktop app and the cockpit, arranged as a bento grid. Images are
 * product screenshots with synthetic workspace data; each tile links to the guide for that screen.
 */
const TILES = [
  { src: "/docs/desktop/deployments.webp", title: "Deployments with every gate in view", body: "Branch policy, checks, change windows and approvals before anything is dispatched.", href: "/docs/releaseops", wide: true, focus: "center 30%" },
  { src: "/docs/desktop/agent.webp", title: "An Agent that asks first", body: "Read-only tools run inline; every write waits for a person.", href: "/docs/ask-axiom", wide: false, focus: "center 25%" },
  { src: "/docs/cockpit/checks.webp", title: "Checks at every stage", body: "Smoke tests, scans and pinned GitHub Actions, run in your CI.", href: "/docs/releaseops", wide: false, focus: "center 20%" },
  { src: "/docs/cockpit/delivery-health.webp", title: "Delivery health", body: "Success rate, run time and stuck runs per environment.", href: "/docs/releaseops", wide: false, focus: "center 22%" },
  { src: "/docs/cockpit/custom-roles.webp", title: "Custom roles", body: "Start from a built-in role and remove what a member should not do.", href: "/docs/permissions-model", wide: false, focus: "center 20%" },
  { src: "/docs/cockpit/mcp-servers.webp", title: "Thousands of MCP tools, approved one by one", body: "Add servers from the public registry; agents use only the tools you approve.", href: "/docs/mcp-tools", wide: true, focus: "center 18%" },
  { src: "/docs/desktop/tickets.webp", title: "Tickets linked to releases", body: "Jira, ServiceNow and Linear stay in step with what shipped.", href: "/docs/releaseops", wide: false, focus: "center 30%" },
] as const;

export function ProductBento() {
  return (
    <section aria-labelledby="inside-v19-title" className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:px-10">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">Inside V19</p>
      <h2 id="inside-v19-title" className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">The real screens, not mockups</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">From the desktop app and the web cockpit, shown with a synthetic workspace.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <li key={t.src} className={t.wide ? "sm:col-span-2" : ""}>
            <Link href={t.href} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#0f0f0f] transition hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50">
              <div className="relative aspect-[16/9] overflow-hidden border-b border-white/6 bg-black">
                <img src={t.src} alt={`${t.title}: V19 screen with synthetic data`} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" style={{ objectPosition: t.focus }} />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-[15px] font-medium text-white">{t.title}</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{t.body}</p>
                <span className="mt-auto pt-3 text-xs text-zinc-300 underline-offset-4 group-hover:underline">Read the guide</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
