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

export const metadata: Metadata = {
  title: "Manifesto — VisionXIXLabs",
  description:
    "Why we built VisionXIXLabs. The seven things we believe about AI-assisted cloud operations — approval-first, audit-immutable, transparency-as-default.",
};

interface Tenet {
  num: string;
  short: string;
  long: string;
}

const TENETS: readonly Tenet[] = [
  {
    num: "01",
    short: "Humans approve. Always.",
    long: "An AI that can ship to production without you is a problem you can't undo. Every change we propose passes a human approval gate — even when the agent is certain. Certainty is not authority.",
  },
  {
    num: "02",
    short: "Closed-union over runtime checks.",
    long: "The safest production code is code that can't be wrong. We model every decision as a closed-union type so the compiler rejects category errors before runtime. Safety should be a property of the type system, not a hope at deploy time.",
  },
  {
    num: "03",
    short: "Honesty is the first feature.",
    long: "If a feature isn't shipped, the docs say so. If a connector is in preview, the dashboard tells you. We never describe what we wish were true. Buyers can tell the difference, and trust scales linearly with how rarely we lie.",
  },
  {
    num: "04",
    short: "Audit is not optional.",
    long: "Every action the system takes — approved, rejected, rolled back — writes a sha-256-signed audit row with who, what, when, and why. Compliance is a side-effect, not the goal. The goal is being able to look someone in the eye and explain what happened.",
  },
  {
    num: "05",
    short: "Bounded blast radius.",
    long: "Plans that touch more than a handful of resources auto-stage. Production accounts cap at one. We'd rather ship a smaller fix today than a larger one we can't reverse tomorrow.",
  },
  {
    num: "06",
    short: "Repetition refined into a system.",
    long: "Brand consistency is what design discipline looks like at scale. Every card uses the same material. Every primary CTA uses the same physics. Every page hero shares the same numbered rhythm. Nothing is bespoke unless bespoke is the point.",
  },
  {
    num: "07",
    short: "Connect once. Stay connected.",
    long: "The IAM role you set up on day one is the IAM role we use forever. We don't ask for more access as features ship. We don't store credentials. We assume-role for every operation. Revoke us from your own console any time — we will not phone home asking why.",
  },
];

export default function ManifestoPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Restrained aurora — quieter than typical marketing pages */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[480px] rounded-full bg-brand-coral/[0.06] blur-[150px]" />
        <div className="ambient-drift absolute top-[40%] right-[5%] w-[460px] h-[400px] rounded-full bg-brand-violet/[0.06] blur-[140px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute bottom-0 left-[5%] w-[380px] h-[300px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <Navigation />

      <SectionRail items={TENETS.map((t) => ({ id: `tenet-${t.num}`, label: t.short, num: t.num }))} />

      <main className="relative max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-32">
        {/* Tiny manifesto eyebrow */}
        <p className="mono-label inline-flex items-center gap-3 mb-6">
          <span className="text-brand-coral/90 tabular-nums">MA</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Manifesto
        </p>

        {/* Big declarative statement */}
        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.02] mb-8 tracking-[-0.045em]">
          Seven things{" "}
          <span className="relative inline-block">
            we believe.
            <span aria-hidden className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </h1>

        <p className="text-[17px] text-zinc-400 max-w-2xl leading-relaxed mb-24">
          Approval-first. Audit-immutable. Transparency-as-default. These are
          the seven principles we use to decide what ships, what doesn&apos;t,
          and what we&apos;ll never build &mdash; even when the market would
          let us.
        </p>

        {/* Tenets — one per scroll, Apple keynote rhythm */}
        <div className="space-y-28">
          {TENETS.map((tenet) => (
            <article key={tenet.num} id={`tenet-${tenet.num}`} className="relative scroll-mt-24">
              {/* Subtle coral hairline above each tenet */}
              <div className="hairline-soft mb-10" />
              <p className="mono-label mb-6 inline-flex items-center gap-3">
                <span className="text-brand-coral/90 tabular-nums text-[11px]">{tenet.num}</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                <span className="text-zinc-500">of 07</span>
              </p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-[1.04] tracking-[-0.035em] mb-6">
                {tenet.short}
              </h2>
              <p className="text-[17px] text-zinc-300 leading-[1.75] max-w-2xl">
                {tenet.long}
              </p>
            </article>
          ))}
        </div>

        {/* Closing signature block — Apple-style "Designed by" */}
        <div className="mt-32 pt-16 border-t border-white/[0.06] text-center">
          <p className="mono-label mb-5">Signed</p>
          <p className="font-display text-2xl md:text-3xl font-bold text-white leading-tight mb-2 tracking-[-0.025em]">
            Designed and built<br className="sm:hidden" /> in New York.
          </p>
          <p className="text-[13px] text-zinc-500 max-w-md mx-auto mb-10">
            By a small team that thinks production AI deserves the same rigor
            as production software.
          </p>

          {/* Single closing CTA */}
          <Link
            href="/operator/onboarding"
            className="btn-press inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[14.5px] font-semibold tracking-tight"
          >
            Run Axiom
            <ArrowRightIcon className="h-4 w-4 opacity-60" />
          </Link>

          <div className="mt-10 flex items-center justify-center gap-6 text-[12px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            <Link href="/changelog" className="hover:text-brand-coral transition-colors">Changelog</Link>
            <span className="text-zinc-700">·</span>
            <Link href="/trust" className="hover:text-brand-coral transition-colors">Trust</Link>
            <span className="text-zinc-700">·</span>
            <Link href="/security" className="hover:text-brand-coral transition-colors">Security</Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
