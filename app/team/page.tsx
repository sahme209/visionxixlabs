/**
 * /team — "how we work" surface. Anonymized values + practices.
 *
 * Not a list of headshots (we're small + private). Instead: the
 * principles a small high-trust team uses to ship serious software.
 * Apple-style restrained presentation.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  EyeSlashIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Team — VisionXIXLabs",
  description:
    "How a small high-trust team ships serious AI-ops software. Six working principles — async-first, type-safety as discipline, approval-only-no-execution applied to ourselves too.",
};

interface Practice {
  num: string;
  title: string;
  icon: typeof ShieldCheckIcon;
  body: string;
}

const PRACTICES: readonly Practice[] = [
  {
    num: "01",
    title: "Small team, narrow surface, deep ownership.",
    icon: CpuChipIcon,
    body: "Fewer hands, fewer handoffs, fewer interface decisions. The same person who designs the closed-union for an approval state writes the SQL migration and the front-end card. Context lives in heads, not in tickets.",
  },
  {
    num: "02",
    title: "Async-first. Calls are a last resort.",
    icon: ChatBubbleLeftRightIcon,
    body: "Most decisions get written down before they're discussed. Calls happen when async has produced two equally-strong arguments and a human needs to break the tie. We're in three time zones — if a decision requires three calendars, it usually requires rewriting.",
  },
  {
    num: "03",
    title: "Closed-union or it didn't ship.",
    icon: CodeBracketIcon,
    body: "Every state, every event, every outcome lives in TypeScript as a closed union. The compiler is the first reviewer. A category we haven't typed is a category we haven't thought hard enough about — and that's the bug we ship next.",
  },
  {
    num: "04",
    title: "Approval-only-no-execution. Applied to ourselves too.",
    icon: ShieldCheckIcon,
    body: "We don't auto-deploy. We don't auto-merge. We don't auto-promote. Every change passes a human gate, the same way the agent does. The discipline applies up the stack — if we wouldn't trust the AI to ship without us, we shouldn't trust ourselves to ship without each other.",
  },
  {
    num: "05",
    title: "Audit trail for engineering decisions.",
    icon: ClockIcon,
    body: "Every non-trivial architectural decision gets a one-page ADR in source control. Why this, why not the alternative, what we expect to learn that will make us reverse it. Six months from now we want to know what past-us was thinking — and whether they were right.",
  },
  {
    num: "06",
    title: "Quiet roster. Loud product.",
    icon: EyeSlashIcon,
    body: "We don't list headshots. We don't have a press kit. The work speaks. If you're hiring us, the manifesto, the docs, and the changelog tell you who we are — better than a photo grid would.",
  },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[480px] rounded-full bg-brand-violet/[0.07] blur-[150px]" />
        <div className="ambient-drift absolute top-[40%] right-[5%] w-[460px] h-[400px] rounded-full bg-brand-coral/[0.06] blur-[140px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute bottom-0 left-[5%] w-[380px] h-[300px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <Navigation />

      <main className="relative max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-32">
        <p className="mono-label inline-flex items-center gap-3 mb-6">
          <span className="text-brand-coral/90 tabular-nums">TM</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Team
        </p>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.02] mb-8 tracking-[-0.045em]">
          A small team{" "}
          <span className="relative inline-block">
            shipping carefully.
            <span aria-hidden className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </h1>

        <p className="text-[17px] text-zinc-400 max-w-2xl leading-relaxed mb-16">
          We don&apos;t have a headshot grid. We do have six working principles
          that explain how a small high-trust team ships serious AI-operations
          software without breaking it &mdash; or you.
        </p>

        <div className="space-y-20">
          {PRACTICES.map((p) => {
            const Icon = p.icon;
            return (
              <article key={p.num} className="surface-glass rounded-2xl p-7 sm:p-9 hover:border-brand-coral/20 transition-all">
                <header className="flex items-center gap-4 mb-5">
                  <div className="shrink-0 w-10 h-10 rounded-lg border border-brand-coral/25 bg-gradient-to-br from-brand-coral/10 to-brand-violet/10 flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5 text-brand-coral" style={{ height: "1.125rem", width: "1.125rem" }} />
                  </div>
                  <div>
                    <p className="mono-label text-[10px] text-brand-coral/85 mb-0.5">{p.num} / 06</p>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight">
                      {p.title}
                    </h2>
                  </div>
                </header>
                <p className="text-[15px] text-zinc-300 leading-[1.78]">{p.body}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-28 pt-12 border-t border-white/[0.06]">
          <p className="mono-label mb-4">Hiring</p>
          <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-3 leading-tight tracking-[-0.025em]">
            We are not hiring right now.
          </h3>
          <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl mb-6">
            When we do, we&apos;ll post here. The bar is: would I trust this
            person to merge a Terraform plan against my own production account?
            That filter keeps the team small.
          </p>
          <Link
            href="/manifesto"
            className="btn-ghost-press inline-flex items-center gap-2 px-5 py-3 rounded-full text-[13.5px] font-medium tracking-tight"
          >
            Read our manifesto
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
