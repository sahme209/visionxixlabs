/**
 * /design — the design system, presented as a feature.
 *
 * Tokens, materials, typography, motion, and primitives — shown
 * not described. Stripe + Linear + Huly all have one of these.
 * Acts as both portfolio and changelog for the visual system.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Design System — VisionXIXLabs",
  description:
    "The tokens, materials, typography, motion, and primitives behind every page on visionxixlabs.com. Show, don't describe.",
};

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[480px] rounded-full bg-brand-violet/[0.07] blur-[150px]" />
        <div className="ambient-drift absolute top-[40%] right-[5%] w-[460px] h-[400px] rounded-full bg-brand-coral/[0.06] blur-[140px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute bottom-0 left-[5%] w-[380px] h-[300px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <Navigation />

      <main className="relative max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-32">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <p className="mono-label inline-flex items-center gap-3 mb-6">
          <span className="text-brand-coral/90 tabular-nums">DS</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Design system
        </p>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.02] mb-8 tracking-[-0.045em]">
          The visual system.{" "}
          <span className="relative inline-block">
            Shown, not described.
            <span aria-hidden className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </h1>

        <p className="text-[17px] text-zinc-400 max-w-2xl leading-relaxed mb-16">
          Every page on this site is built from a small set of primitives. Tokens,
          materials, typography, motion, and a handful of named components.{" "}
          <Link href="/principles" className="text-brand-coral hover:underline">/principles</Link>{" "}
          explains the rules. This page shows the result.
        </p>

        {/* ── COLOR ─────────────────────────────────────────────── */}
        <Section number="01" title="Color">
          <p className="text-zinc-300 leading-relaxed mb-8 max-w-2xl">
            One accent. Coral. Used sparingly — for active states, hover affordances,
            and the single underline under the punch word of every headline. Violet
            is the cool base. Cyan appears only in ambient washes.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Swatch name="brand-coral" hex="#F472B6" cls="bg-brand-coral" />
            <Swatch name="brand-violet" hex="#8B5CF6" cls="bg-brand-violet" />
            <Swatch name="cyan-500" hex="#06B6D4" cls="bg-cyan-500" />
            <Swatch name="emerald-400" hex="#34D399" cls="bg-emerald-400" semantic />
          </div>
        </Section>

        {/* ── TYPOGRAPHY ────────────────────────────────────────── */}
        <Section number="02" title="Typography">
          <p className="text-zinc-300 leading-relaxed mb-8 max-w-2xl">
            Inter with SF-Pro-leaning OpenType features (cv02 rounded g, cv11
            single-storey a, ss03 shorter 8). JetBrains Mono for tabular numerals
            + mono labels. Three sizes per screen. No more.
          </p>
          <div className="space-y-6">
            <TypeRow rule="font-display 5xl-7xl" sample="Display headline.">
              <span className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.02] tracking-[-0.045em]">Display headline.</span>
            </TypeRow>
            <TypeRow rule="text-base zinc-400" sample="Body paragraph at 16px.">
              <span className="text-[16px] text-zinc-400 leading-[1.78]">
                Body paragraph at 16px with 1.78 line height. Apple-grade reading rhythm.
                The body is meant to be read, not skimmed.
              </span>
            </TypeRow>
            <TypeRow rule=".mono-label" sample="01 ⎯ Mono label">
              <span className="mono-label inline-flex items-center gap-3">
                <span className="text-brand-coral/90 tabular-nums">01</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                Mono label
              </span>
            </TypeRow>
            <TypeRow rule=".spec-stat-value" sample="35% spec stat">
              <span className="spec-stat-value text-5xl text-white font-display">
                35<span className="spec-stat-unit">%</span>
              </span>
            </TypeRow>
          </div>
        </Section>

        {/* ── MATERIALS ────────────────────────────────────────── */}
        <Section number="03" title="Materials">
          <p className="text-zinc-300 leading-relaxed mb-8 max-w-2xl">
            Two materials. Both real frosted glass — backdrop-saturate(140%) plus
            a top-edge inner highlight so the eye reads thickness, not flatness.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="surface-glass rounded-2xl p-6">
              <p className="mono-label text-brand-coral/85 mb-2">.surface-glass</p>
              <p className="text-[13.5px] text-zinc-300 leading-relaxed mb-4">
                The default card material. Used everywhere a card needs to feel
                like a surface, not a tint.
              </p>
              <code className="font-mono text-[11px] text-brand-coral/85 bg-white/[0.04] px-2 py-1 rounded">backdrop-blur(20px) saturate(140%)</code>
            </div>
            <div className="surface-frost rounded-2xl p-6">
              <p className="mono-label text-brand-coral/85 mb-2">.surface-frost</p>
              <p className="text-[13.5px] text-zinc-300 leading-relaxed mb-4">
                The premium variant. Stronger blur + saturate, soft coral wash
                from the top-left corner. Used for hero accessories.
              </p>
              <code className="font-mono text-[11px] text-brand-coral/85 bg-white/[0.04] px-2 py-1 rounded">backdrop-blur(28px) saturate(160%)</code>
            </div>
          </div>
        </Section>

        {/* ── BUTTONS ─────────────────────────────────────────── */}
        <Section number="04" title="Buttons">
          <p className="text-zinc-300 leading-relaxed mb-8 max-w-2xl">
            Two button physics. Both use Apple&apos;s slow-out cubic-bezier so they
            feel weighted instead of springy. Hover lifts 1px + adds a 5px coral
            aura. Active snaps down in 50ms.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn-press inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold tracking-tight">
              .btn-press
              <ArrowRightIcon className="h-4 w-4 opacity-60" />
            </button>
            <button className="btn-ghost-press inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-medium tracking-tight">
              .btn-ghost-press
            </button>
            <span className="text-[11.5px] font-mono text-zinc-500">try hover + click</span>
          </div>
        </Section>

        {/* ── ANATOMY ─────────────────────────────────────────── */}
        <Section number="05" title="Page anatomy">
          <p className="text-zinc-300 leading-relaxed mb-8 max-w-2xl">
            Every marketing hero follows the same five-line rhythm. Same numbered eyebrow,
            same display headline with one underlined punch word, same 3-pool aurora behind.
          </p>
          <div className="surface-glass rounded-2xl p-8">
            <p className="mono-label inline-flex items-center gap-3 mb-5">
              <span className="text-brand-coral/90 tabular-nums">EX</span>
              <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              <span>Sample hero</span>
            </p>
            <h3 className="font-display text-3xl sm:text-4xl font-bold text-white leading-[1.04] tracking-[-0.035em] mb-3">
              A familiar{" "}
              <span className="relative inline-block">
                pattern.
                <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
              </span>
            </h3>
            <p className="text-[14.5px] text-zinc-400 max-w-xl leading-relaxed mb-4">
              Mono-label, font-display headline with restrained coral hairline on
              the punch word, max-w-2xl lede. Then content. Same shape every time.
            </p>
            <div className="hairline-soft" />
            <p className="text-[11px] font-mono text-zinc-500 mt-3 tracking-[0.18em] uppercase">5-line rhythm</p>
          </div>
        </Section>

        {/* ── MOTION ──────────────────────────────────────────── */}
        <Section number="06" title="Motion">
          <p className="text-zinc-300 leading-relaxed mb-8 max-w-2xl">
            One ease curve everywhere: <code className="font-mono text-brand-coral/85 bg-white/[0.04] px-1.5 py-0.5 rounded text-[12.5px]">cubic-bezier(0.16, 1, 0.30, 1)</code>.
            Slow out, deliberate arrival. Apple&apos;s product-video curve.
          </p>
          <ul className="space-y-2 text-[14px] text-zinc-300">
            <li>· Hero cursor: 1.2s slow-out arrival</li>
            <li>· Button hover: 420ms slow-out lift + coral aura</li>
            <li>· Button active: 50ms snap-down</li>
            <li>· Aurora pools: 9-15s ambient drift, randomized phases</li>
            <li>· Section dot rail: 300ms smooth-step transitions</li>
          </ul>
        </Section>

        {/* ── PRIMITIVES ──────────────────────────────────────── */}
        <Section number="07" title="Primitives">
          <p className="text-zinc-300 leading-relaxed mb-8 max-w-2xl">
            Eleven shared React components. Refactoring any one of them
            propagates to every page that uses it — which is most pages.
          </p>
          <div className="surface-glass rounded-2xl p-6">
            <ul className="grid sm:grid-cols-2 gap-2 text-[12.5px] font-mono text-zinc-300">
              {[
                "<Navigation>", "<Footer>", "<DocHeader>",
                "<FeatureRow>", "<TestimonialsCarousel>", "<DesktopShowcase>",
                "<EnterpriseTrustSignals>", "<ServicePipeline>", "<CaseStudyBlock>",
                "<ArchitectureReferenceCard>", "<FAQAccordion>", "<AnimatedButton>",
                "<SectionRail>", "<CommandPalette>", "<ScrollProgress>",
              ].map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <CheckIcon className="h-3 w-3 text-brand-coral/85 shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ── CMD K ──────────────────────────────────────────── */}
        <Section number="08" title="⌘K">
          <p className="text-zinc-300 leading-relaxed mb-6 max-w-2xl">
            Global keyboard navigator. ⌘K (Mac) / Ctrl+K (everywhere else)
            opens a frosted-glass command palette with fuzzy search across
            every page on the site. Linear / Vercel / Cron-grade.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <kbd className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-coral/30 bg-brand-coral/[0.06] text-brand-coral font-mono text-[12px] tracking-tight">
              ⌘ K
            </kbd>
            <span className="text-[12px] font-mono text-zinc-500">try it now</span>
          </div>
        </Section>

        {/* Closing block */}
        <div className="mt-24 pt-12 border-t border-white/[0.06] grid sm:grid-cols-2 gap-6">
          <div>
            <p className="mono-label mb-2">See also</p>
            <ul className="space-y-1.5 text-[13.5px] text-zinc-300">
              <li><Link href="/principles" className="hover:text-brand-coral transition-colors">/principles &mdash; why these decisions →</Link></li>
              <li><Link href="/handbook" className="hover:text-brand-coral transition-colors">/handbook &mdash; how we build it →</Link></li>
              <li><Link href="/manifesto" className="hover:text-brand-coral transition-colors">/manifesto &mdash; what we believe →</Link></li>
            </ul>
          </div>
          <div className="flex justify-start sm:justify-end">
            <Link
              href="/"
              className="btn-ghost-press inline-flex items-center gap-2 px-5 py-3 rounded-full text-[13.5px] font-medium tracking-tight"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-24">
      <p className="mono-label mb-6 inline-flex items-center gap-3">
        <span className="text-brand-coral/90 tabular-nums">{number}</span>
        <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
        <span className="text-zinc-500">{title}</span>
      </p>
      {children}
    </section>
  );
}

function Swatch({ name, hex, cls, semantic }: { name: string; hex: string; cls: string; semantic?: boolean }) {
  return (
    <div className="surface-glass rounded-xl overflow-hidden">
      <div className={`h-20 ${cls}`} />
      <div className="p-3">
        <p className="font-mono text-[11.5px] text-white">{name}</p>
        <p className="font-mono text-[10px] text-zinc-500 mt-0.5">{hex}</p>
        {semantic && <p className="text-[9.5px] font-mono text-emerald-400/85 uppercase tracking-wider mt-1">semantic only</p>}
      </div>
    </div>
  );
}

function TypeRow({ rule, sample, children }: { rule: string; sample: string; children: React.ReactNode }) {
  void sample;
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6 pb-5 border-b border-white/[0.04]">
      <p className="font-mono text-[10.5px] text-brand-coral/75 uppercase tracking-wider w-40 shrink-0 whitespace-nowrap">{rule}</p>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
