/**
 * /principles — design principles surface. Companion to /manifesto.
 *
 * /manifesto = what we believe about the product.
 * /principles = how we make visual + interaction decisions.
 *
 * Apple-style declarative content. Each principle is a single
 * statement with a brief explanation. No bordered cards on the
 * statements themselves — only the example screenshots get framed.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SectionRail } from "@/components/motion/SectionRail";

export const metadata: Metadata = {
  title: "Design Principles — VisionXIXLabs",
  description:
    "How VisionXIXLabs makes visual and interaction decisions. Eight design principles — restraint, repetition, materials, hierarchy, motion, color, density, honesty.",
};

interface Principle {
  num: string;
  title: string;
  rule: string;
  detail: string;
  example?: string;
}

const PRINCIPLES: readonly Principle[] = [
  {
    num: "01",
    title: "Restraint",
    rule: "Remove what doesn't earn its place.",
    detail: "Every accent, every animation, every gradient is asked: 'what would the page lose if this were gone?' If the answer is 'not much', it goes. Jony Ive's first edit is always a subtraction.",
  },
  {
    num: "02",
    title: "Repetition",
    rule: "Brand consistency is design discipline at scale.",
    detail: "Every page hero uses the same numbered eyebrow. Every card uses one of two materials. Every primary CTA uses the same physics. Nothing is bespoke unless bespoke is the point — and bespoke is almost never the point.",
  },
  {
    num: "03",
    title: "Materials",
    rule: "Surfaces should feel like they have weight.",
    detail: "Frosted glass with backdrop-saturate, not flat tints. Top-edge inner highlight on every glass card so the eye reads thickness. Outer shadow that breathes on hover. This is what separates a 2026 product page from a 2018 one.",
  },
  {
    num: "04",
    title: "Hierarchy",
    rule: "Three font sizes per screen. No more.",
    detail: "Display headline. Body. Mono label. Anything else is decoration. The .font-display utility tightens letter-spacing and enables SF-Pro-leaning OpenType features so the headline does the work without a second size to help it.",
  },
  {
    num: "05",
    title: "Motion",
    rule: "Slow-out, deliberate arrival.",
    detail: "cubic-bezier(0.16, 1, 0.30, 1). Slower than spring physics, more intentional than ease-out. Apple's product-video curve. Click flashes pulse once, slowly, then wait — they don't strobe.",
  },
  {
    num: "06",
    title: "Color",
    rule: "One accent. Coral.",
    detail: "Violet is the cool base. Coral (#F472B6) is the warm signal. Cyan appears in ambient washes only. Every other color is semantic (emerald for success, rose for danger, amber for warning) and used only at semantic boundaries.",
  },
  {
    num: "07",
    title: "Density",
    rule: "Apple-grade vertical rhythm.",
    detail: "py-28 for major sections. py-12 for sub-sections. Line-height 1.75 for body, 1.04 for display. Whitespace is the design — every page should feel like it can breathe without scrolling.",
  },
  {
    num: "08",
    title: "Honesty",
    rule: "Design must tell the truth about state.",
    detail: "Live = pinging dot. Disabled = greyed. Loading = skeleton. Don't disguise an inactive feature as active just because it looks better. The product page should accurately reflect what shipped.",
  },
];

export default function PrinciplesPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Restrained aurora — quieter than marketing pages */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[480px] rounded-full bg-brand-violet/[0.07] blur-[150px]" />
        <div className="ambient-drift absolute top-[40%] right-[5%] w-[460px] h-[400px] rounded-full bg-brand-coral/[0.06] blur-[140px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute bottom-0 left-[5%] w-[380px] h-[300px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <Navigation />

      <SectionRail items={PRINCIPLES.map((p) => ({ id: `principle-${p.num}`, label: p.title, num: p.num }))} />

      <main className="relative max-w-[1400px] mx-auto px-6 md:px-10 pt-32 pb-32">
        <p className="mono-label inline-flex items-center gap-3 mb-6">
          <span className="text-brand-coral/90 tabular-nums">PR</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Design principles
        </p>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.02] mb-8 tracking-[-0.045em]">
          How we make{" "}
          <span className="relative inline-block">
            visual decisions.
            <span aria-hidden className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </h1>

        <p className="text-[17px] text-zinc-400 max-w-2xl leading-relaxed mb-16">
          Eight principles &mdash; the rules behind every page, every component,
          every animation. Companion to{" "}
          <Link href="/manifesto" className="text-brand-coral hover:underline">
            our manifesto
          </Link>
          : that one is what we believe about the product; this one is how we
          decide what to ship.
        </p>

        <div className="space-y-24">
          {PRINCIPLES.map((p) => (
            <article key={p.num} id={`principle-${p.num}`} className="relative scroll-mt-24">
              <div className="hairline-soft mb-10" />
              <p className="mono-label mb-5 inline-flex items-center gap-3">
                <span className="text-brand-coral/90 tabular-nums text-[11px]">{p.num}</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                <span className="text-zinc-500">{p.title}</span>
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-[1.06] tracking-[-0.035em] mb-5">
                {p.rule}
              </h2>
              <p className="text-[16px] text-zinc-300 leading-[1.78] max-w-2xl">
                {p.detail}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-32 pt-16 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="mono-label mb-2">Companion piece</p>
            <p className="font-display text-xl font-semibold text-white">Our manifesto &mdash; what we believe about the product.</p>
          </div>
          <Link
            href="/manifesto"
            className="btn-ghost-press inline-flex items-center gap-2 px-5 py-3 rounded-full text-[13.5px] font-medium tracking-tight shrink-0"
          >
            Read the manifesto
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
