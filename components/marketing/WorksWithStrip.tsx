import { INTEGRATION_LOGOS } from "@/lib/marketing/integrationLogos";

/**
 * Home page "works with" strip, balanced and quiet. Integrations, not customers.
 * Only items with a non-planned status are shown; the caption says so.
 */
export function WorksWithStrip() {
  const items = INTEGRATION_LOGOS.filter((i) => i.onHome);
  return (
    <section aria-labelledby="works-with" className="border-y border-white/[0.06] px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <p id="works-with" className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Works with the tools you already use</p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {items.map((i) => (
            <li key={i.id} className="flex h-8 items-center" title={`${i.name} · ${i.status}`}>
              {i.logo
                ? <img src={i.logo} alt={i.name} width={22} height={22} className="h-[22px] w-auto opacity-55 invert transition hover:opacity-90" loading="lazy" />
                : <span className="text-[15px] font-medium tracking-tight text-zinc-400">{i.name}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-[11px] text-zinc-600">Integrations available or in preview in Axiom. Logos are trademarks of their owners and do not imply endorsement. <a href="/integrations" className="underline underline-offset-2 hover:text-zinc-400">See each status</a></p>
      </div>
    </section>
  );
}
