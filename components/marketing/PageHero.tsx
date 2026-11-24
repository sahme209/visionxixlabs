import type { ReactNode } from "react";

/** Centered interior-page header using the shared public type and spacing roles. */
export function PageHero({ eyebrow, title, muted, lead, note, actions, children }: {
  eyebrow: string; title: ReactNode; muted?: ReactNode; lead: ReactNode; note?: ReactNode; actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="public-page-hero flex flex-col items-center gap-6 border-b border-white/[0.07] pb-12 text-center">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p>
        <h1 className="mt-5 text-[clamp(2.4rem,4.6vw,4.25rem)] font-medium leading-[1.04] tracking-[-0.045em] text-zinc-50">
          {title}{muted ? <><br /><span className="text-zinc-500">{muted}</span></> : null}
        </h1>
      </div>
      <div className="lg:pb-2">
        <p className="text-base leading-7 text-zinc-300 sm:text-[17px]">{lead}</p>
        {actions ? <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
        {note ? <p className="mt-5 text-[13px] leading-6 text-zinc-400">{note}</p> : null}
        {children}
      </div>
    </header>
  );
}
