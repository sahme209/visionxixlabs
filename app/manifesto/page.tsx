/**
 * /manifesto — declarative content surface. No nav crowding, big serif,
 * one coral accent. The "Designed in California" equivalent for
 * VisionXIXLabs. Apple product-page rhythm: one statement per screen.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SectionRail } from "@/components/motion/SectionRail";
import { PageHero } from "@/components/marketing/PageHero";

export const metadata: Metadata = {
  title: "Manifesto — VisionXIXLabs",
  description:
    "Why we built VisionXIXLabs. The seven things we believe about AI-assisted cloud operations — human authority, reviewable evidence, scoped access and clear availability limits.",
};

interface Tenet {
  num: string;
  short: string;
  long: string;
}

const TENETS: readonly Tenet[] = [
  {
    num: "01",
    short: "Human authority stays explicit.",
    long: "We design consequential changes around a reviewable proposal and explicit human authority. Check the controls available for your operation and version; complete Governance coverage and activation remain unfinished. Certainty is not authority.",
  },
  {
    num: "02",
    short: "Types and runtime checks, together.",
    long: "Closed-union types help catch category errors before runtime. They do not prove that execution is safe. External input, current permissions and actual outcomes still need validation.",
  },
  {
    num: "03",
    short: "Honesty is the first feature.",
    long: "Describe capabilities at the level the evidence supports: source, simulation, preview or verified workflow. Mark uncertainty and missing acceptance clearly. A configuration screen or a green build is not proof of a completed customer operation.",
  },
  {
    num: "04",
    short: "Audit is not optional.",
    long: "Recorded events and linked SHA-256 seals support audit review. They are not signatures on every action or tamper prevention; coverage, storage availability and verification limits matter. The goal is being able to explain what happened with evidence.",
  },
  {
    num: "05",
    short: "Bounded blast radius.",
    long: "Prefer small, reviewable changes with explicit recovery. Check the configured planning limits and the enforcement available for the exact execution path. Planning bounds alone do not establish live provider limits or verified recovery.",
  },
  {
    num: "06",
    short: "Repetition refined into a system.",
    long: "Brand consistency is what design discipline looks like at scale. Every card uses the same material. Every primary CTA uses the same physics. Every page hero shares the same numbered rhythm. Nothing is bespoke unless bespoke is the point.",
  },
  {
    num: "07",
    short: "Access deserves ongoing review.",
    long: "Connect only what the workflow needs. Review the requested scopes, credential handling and revocation for each integration. Some integrations retain encrypted, context-bound credentials; an existing connection does not authorize future access expansion.",
  },
];

export default function ManifestoPage() {
  return (
    <div className="axiom-canvas min-h-screen bg-[#0a0908] text-zinc-100">
      <Navigation />

      <SectionRail items={TENETS.map((t) => ({ id: `tenet-${t.num}`, label: t.short, num: t.num }))} />

      <main className="public-reading-marketing-page">
        <PageHero
          eyebrow="Manifesto"
          title="Seven things"
          muted="we believe."
          lead={<>
          Human authority. Reviewable evidence. Clear limits. These are
          the seven principles we use to decide what ships, what doesn&apos;t,
          and what we&apos;ll never build &mdash; even when the market would
          let us. Availability and enforcement depend on the operation, installed version and current configuration.
        </>}
        />

        <div className="space-y-28">
          {TENETS.map((tenet) => (
            <article key={tenet.num} id={`tenet-${tenet.num}`} className="relative scroll-mt-24">
              {/* A quiet divider separates each tenet. */}
              <div className="mb-10 h-px bg-white/[0.08]" />
              <p className="mono-label mb-6 inline-flex items-center gap-3">
                <span className="text-zinc-400 tabular-nums text-[11px]">{tenet.num}</span>
                <span className="h-px w-6 bg-white/10" />
                <span className="text-zinc-500">of 07</span>
              </p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-white leading-[1.04] tracking-[-0.035em] mb-6">
                {tenet.short}
              </h2>
              <p className="text-[17px] text-zinc-300 leading-[1.75] max-w-2xl">
                {tenet.long}
              </p>
            </article>
          ))}
        </div>

        {/* Closing signature block — Apple-style "Designed by" */}
        <div className="mt-32 pt-16 border-t border-white/6 text-center">
          <p className="mono-label mb-5">Signed</p>
          <p className="font-display text-2xl md:text-3xl font-medium text-white leading-tight mb-2 tracking-tight">
            Designed and built<br className="sm:hidden" /> in New York.
          </p>
          <p className="text-[13px] text-zinc-500 max-w-md mx-auto mb-10">
            By a small team that thinks production AI deserves the same rigor
            as production software.
          </p>

          {/* Single closing CTA */}
          <Link
            href="/download"
            className="inline-flex bg-white text-[#0a0908] hover:bg-zinc-100 items-center gap-2 px-7 py-3.5 rounded-full text-[14.5px] font-semibold tracking-tight"
          >
            Download Axiom Agent
            <ArrowRightIcon className="h-4 w-4 opacity-60" />
          </Link>

          <div className="mt-10 flex items-center justify-center gap-6 text-[12px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            <Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link>
            <span className="text-zinc-700">·</span>
            <Link href="/trust" className="hover:text-white transition-colors">Trust</Link>
            <span className="text-zinc-700">·</span>
            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
