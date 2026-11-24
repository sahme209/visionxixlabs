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
import { SectionRail } from "@/components/motion/SectionRail";
import { PageHero } from "@/components/marketing/PageHero";

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
    body: "We don't list headshots. We don't have a press kit. The work speaks. If you're hiring us, the manifesto, the docs, and the desktop release notes tell you who we are — better than a photo grid would.",
  },
];

export default function TeamPage() {
  return (
    <div className="axiom-canvas min-h-screen bg-[#0a0908] text-zinc-100">
      <Navigation />

      <SectionRail items={PRACTICES.map((p) => ({ id: `team-${p.num}`, label: p.title.replace(/[.,].*/, ""), num: p.num }))} />

      <main className="public-reading-marketing-page">
        <PageHero
          eyebrow="Team"
          title="A small team"
          muted="shipping carefully."
          lead={<>
          We don&apos;t have a headshot grid. We do have six working principles
          that explain how a small high-trust team ships serious AI-operations
          software without breaking it &mdash; or you.
        </>}
        />

        <div className="space-y-20">
          {PRACTICES.map((p) => {
            const Icon = p.icon;
            return (
              <article key={p.num} id={`team-${p.num}`} tabIndex={-1} className="rounded-xl border border-white/[0.08] bg-[#171615] p-7 sm:p-9 scroll-mt-6">
                <header className="flex items-center gap-4 mb-5">
                  <div className="shrink-0 w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5 text-zinc-300" style={{ height: "1.125rem", width: "1.125rem" }} />
                  </div>
                  <div>
                    <p className="mono-label text-[10px] text-zinc-400 mb-0.5">{p.num} / 06</p>
                    <h2 className="font-display text-xl sm:text-2xl font-medium text-white leading-tight tracking-tight">
                      {p.title}
                    </h2>
                  </div>
                </header>
                <p className="text-[15px] text-zinc-300 leading-[1.78]">{p.body}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-28 pt-12 border-t border-white/6">
          <p className="mono-label mb-4">Hiring</p>
          <h3 className="font-display text-2xl md:text-3xl font-medium text-white mb-3 leading-tight tracking-tight">
            We are not hiring right now.
          </h3>
          <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl mb-6">
            When we do, we&apos;ll post here. The bar is: would I trust this
            person to merge a Terraform plan against my own production account?
            That filter keeps the team small.
          </p>
          <Link
            href="/manifesto"
            className="inline-flex border border-white/15 bg-white/[0.02] hover:bg-white/[0.05] items-center gap-2 px-5 py-3 rounded-full text-[13.5px] font-medium tracking-tight"
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
