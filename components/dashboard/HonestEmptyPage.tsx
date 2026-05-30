/**
 * HonestEmptyPage — used for dashboard surfaces whose canonical
 * tables aren't wired yet. Renders a calm one-card explanation
 * instead of demo data.
 *
 * Used to avoid SAMPLE_/DEMO_/MOCK_ arrays leaking into the portal.
 * Per the no-mock-data rule, every visible number must be a real
 * read; pages that can't satisfy that yet render this component.
 */

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export function HonestEmptyPage({
  kicker,
  title,
  description,
  needs,
  ctaHref = "/dashboard",
  ctaLabel = "Back to dashboard",
}: {
  kicker: string;
  title: string;
  description: string;
  /** Bullet list of canonical sources the surface will pull from when wired. */
  needs: ReadonlyArray<string>;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">{kicker}</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          {title}
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          {description}
        </p>
      </header>

      <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-7">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
          this surface reads from
        </p>
        <ul className="space-y-2 mb-6">
          {needs.map((n) => (
            <li key={n} className="text-[12px] text-zinc-400 leading-relaxed">
              · {n}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          The page renders an honest empty state until at least one of these
          sources has data. No sample numbers — by design.
        </p>
      </div>

      <Link
        href={ctaHref}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
      >
        {ctaLabel}
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
