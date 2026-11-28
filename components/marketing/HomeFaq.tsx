import Link from "next/link";
import { FAQ_GROUPS } from "@/lib/support/faqData";

/** A short FAQ on the home page, from the same answers as the full FAQ guide. */
export function HomeFaq({ limit = 6 }: { limit?: number }) {
  const items = FAQ_GROUPS.flatMap((g) => g.items).slice(0, limit);
  return (
    <section aria-labelledby="home-faq-title" className="mx-auto max-w-[880px] px-5 py-20 sm:px-8">
      <h2 id="home-faq-title" className="text-center text-3xl font-semibold tracking-[-0.03em] text-white">Questions, answered</h2>
      <div className="mt-10 divide-y divide-white/8 border-y border-white/8">
        {items.map((it) => (
          <details key={it.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] text-zinc-100 [&::-webkit-details-marker]:hidden">
              {it.q}
              <span aria-hidden className="text-lg text-zinc-500 transition group-open:rotate-45 motion-reduce:transition-none">+</span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{it.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-zinc-400"><Link href="/docs/faq" className="underline underline-offset-4">All questions</Link></p>
    </section>
  );
}
