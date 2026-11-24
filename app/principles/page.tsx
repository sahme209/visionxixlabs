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
import { PageHero } from "@/components/marketing/PageHero";

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
    detail: "Every page hero shares the same typography and spacing. Every card uses a consistent neutral surface. Every primary CTA uses the same physics. Nothing is bespoke unless bespoke is the point — and bespoke is almost never the point.",
  },
  {
    num: "03",
    title: "Materials",
    rule: "Opaque surfaces. Clear edges.",
    detail: "Use near-black opaque panels, restrained borders, and clear spacing to establish depth. Reading surfaces stay quiet and legible. Blur and layered glass are not the default material for the public website.",
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
    rule: "Neutral by default.",
    detail: "The public interface uses near-black structure, white primary text, and warm neutral secondary text. Original artwork can retain its color. Labels and icons must explain state; color alone is never the only way to identify success, warning, or failure.",
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
    <div className="axiom-canvas min-h-screen bg-[#0a0908] text-zinc-100">
      <Navigation />

      <SectionRail items={PRINCIPLES.map((p) => ({ id: `principle-${p.num}`, label: p.title, num: p.num }))} />

      <main className="public-reading-marketing-page">
        <PageHero
          eyebrow="Design principles"
          title="How we make"
          muted="visual decisions."
          lead={<>
          Eight principles &mdash; the rules behind every page, every component,
          every animation. Companion to{" "}
          <Link href="/manifesto" className="text-zinc-300 hover:underline">
            our manifesto
          </Link>
          : that one is what we believe about the product; this one is how we
          decide what to ship.
        </>}
        />

        <div className="space-y-24">
          {PRINCIPLES.map((p) => (
            <article key={p.num} id={`principle-${p.num}`} tabIndex={-1} className="relative scroll-mt-6">
              <div className="mb-10 h-px bg-white/[0.08]" />
              <p className="mono-label mb-5 inline-flex items-center gap-3">
                <span className="text-zinc-400 tabular-nums text-[11px]">{p.num}</span>
                <span className="h-px w-6 bg-white/10" />
                <span className="text-zinc-500">{p.title}</span>
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-medium text-white leading-[1.06] tracking-[-0.035em] mb-5">
                {p.rule}
              </h2>
              <p className="text-[16px] text-zinc-300 leading-[1.78] max-w-2xl">
                {p.detail}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-32 pt-16 border-t border-white/6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="mono-label mb-2">Companion piece</p>
            <p className="font-display text-xl font-semibold text-white">Our manifesto &mdash; what we believe about the product.</p>
          </div>
          <Link
            href="/manifesto"
            className="inline-flex border border-white/15 bg-white/[0.02] hover:bg-white/[0.05] items-center gap-2 px-5 py-3 rounded-full text-[13.5px] font-medium tracking-tight shrink-0"
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
