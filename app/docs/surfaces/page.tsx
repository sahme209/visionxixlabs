/**
 * Public /docs/surfaces — auto-generated catalog of every dashboard
 * surface, drawn from HELP_ENTRIES. Stays in sync with the in-product
 * Help & Docs page without any duplication.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  HELP_ENTRIES,
  helpEntriesByCategory,
  CATEGORY_LABEL,
} from "@/lib/help/helpKnowledgeBase";
import { CATEGORY_TONE } from "../categoryTone";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Surface catalog — Axiom Docs",
  description: "Every Axiom dashboard surface + connector + safety contract, auto-generated from the help knowledge base.",
};

export default function PublicSurfacesPage() {
  const grouped = helpEntriesByCategory();
  const categories = (Object.keys(grouped) as Array<keyof typeof grouped>).filter(
    (c) => grouped[c].length > 0,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-10">
        <p className="text-[10px] font-mono text-cyan-300/80 uppercase tracking-widest mb-2">
          // surface catalog · {HELP_ENTRIES.length} entries · auto-generated
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every surface. <span className="text-gradient">Explained honestly.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Browse every Axiom dashboard surface + connector + safety contract. These docs are the same source
          of truth the in-product Help & Docs page reads — one edit updates both.
        </p>
      </div>

      <nav className="mb-10 flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const tone = CATEGORY_TONE[cat] ?? CATEGORY_TONE.default;
          return (
            <a
              key={cat}
              href={`#${cat}`}
              className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-full border ${tone}`}
            >
              {CATEGORY_LABEL[cat]} · {grouped[cat].length}
            </a>
          );
        })}
      </nav>

      {categories.map((cat) => (
        <section key={cat} id={cat} className="mb-12 scroll-mt-20">
          <p className="text-[11px] font-mono text-cyan-300/80 uppercase tracking-[0.18em] mb-3">
            // {CATEGORY_LABEL[cat]}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grouped[cat].map((e) => (
              <div key={e.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-[14px] font-semibold text-white">{e.title}</p>
                  {e.safetyContract && (
                    <code className="text-[9px] font-mono text-emerald-300 bg-black/30 border border-emerald-500/20 rounded px-1.5 py-0.5">
                      {e.safetyContract}
                    </code>
                  )}
                </div>
                <p className="text-[12px] text-zinc-400 leading-relaxed">{e.description}</p>
                {e.requirements.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300 uppercase tracking-wider">
                      {e.requirements.length} prerequisite{e.requirements.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-1 space-y-0.5 text-[11px] text-zinc-400">
                      {e.requirements.map((r, i) => <p key={i}>· {r}</p>)}
                    </div>
                  </details>
                )}
                {e.href && (
                  <p className="mt-2 text-[10px] font-mono text-cyan-300">
                    route: <code className="text-cyan-200">{e.href}</code>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] text-zinc-400">
        <p>
          This page regenerates automatically when{" "}
          <code className="text-cyan-300">lib/help/helpKnowledgeBase.ts</code> changes. ISR revalidate: 1 hour.
          For the full guided onboarding, see{" "}
          <Link href="/docs/getting-started" className="text-cyan-300 hover:text-cyan-200">Getting started</Link>.
        </p>
      </div>
    </div>
  );
}
