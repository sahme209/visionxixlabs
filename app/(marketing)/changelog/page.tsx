import type { Metadata } from "next";
import Link from "next/link";
import { CHANGELOG } from "@/lib/marketing/changelog";

export const metadata: Metadata = { title: "What's new · V19", description: "Recent V19 releases and improvements, dated when they became available." };

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function ChangelogPage() {
  const dates = [...new Set(CHANGELOG.map((e) => e.date))];
  return (
    <div className="text-white">
      <main className="mx-auto max-w-[880px] px-5 pb-24 pt-32 sm:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">Changelog</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">What&apos;s new in V19</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-zinc-400">Releases and improvements, dated when they became available.</p>
        <ol className="mt-14 space-y-14">
          {dates.map((d) => (
            <li key={d} className="grid gap-6 sm:grid-cols-[160px_1fr]">
              <time dateTime={d} className="text-sm text-zinc-400 sm:sticky sm:top-28 sm:self-start">{fmt(d)}</time>
              <div className="space-y-6">{CHANGELOG.filter((e) => e.date === d).map((e) => (
                <article key={e.title} className="rounded-2xl border border-white/8 bg-[#0f0f0f] p-6">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{e.area}</p>
                  <h2 className="mt-2 text-xl font-medium tracking-tight">{e.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{e.summary}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-400">{e.items.map((i) => <li key={i}>{i}</li>)}</ul>
                  <Link href={e.href} className="mt-4 inline-block text-sm text-zinc-200 underline underline-offset-4">Learn more</Link>
                </article>))}
              </div>
            </li>))}
        </ol>
      </main>
    </div>
  );
}
