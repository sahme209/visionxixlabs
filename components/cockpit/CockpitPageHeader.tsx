import type { ReactNode } from "react";

/**
 * The one page header every cockpit page uses: title, one-line purpose, and optional "How it works"
 * detail folded away so the page opens on its content.
 */
export function CockpitPageHeader({ title, description, howItWorks }: { title: string; description: string; howItWorks?: ReactNode }) {
  return (
    <header>
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-zinc-400">{description}</p>
      {howItWorks && (
        <details className="group mt-3 max-w-3xl text-xs leading-5 text-zinc-400">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-zinc-300 hover:text-white [&::-webkit-details-marker]:hidden"><span aria-hidden className="transition group-open:rotate-90">›</span> How it works</summary>
          <div className="mt-2 space-y-2 border-l border-white/10 pl-3">{howItWorks}</div>
        </details>
      )}
    </header>
  );
}
