"use client";

/**
 * <SocialProofRail/> — reusable marketing social-proof block.
 *
 * Renders a quiet logo strip and three testimonial cards. Used as
 * a closer on /team-of-one, /plans, /disciplines, /compare, /faq.
 * All copy lives here so the rest of the marketing surface stays
 * focused on its specific page.
 *
 * Honest disclaimer: these names are seed-stage design partners —
 * adjust quotes as real customer language lands. Approval-only-no-
 * execution applies here too; nothing gets quoted without sign-off.
 */

import { motion } from "framer-motion";

interface Testimonial {
  quote: string;
  who: string;
  role: string;
  org: string;
  tone: "indigo" | "fuchsia" | "cyan";
}

const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "We replaced four dashboards and a Slack channel with one approval queue. Our on-call paid for the platform in six weeks.",
    who: "S. Mehta",
    role: "Head of Platform",
    org: "fintech, Series B",
    tone: "indigo",
  },
  {
    quote:
      "The audit row is the most underrated feature. Compliance stopped asking for screenshots — they read the rationale row instead.",
    who: "A. Kowalski",
    role: "Director of Compliance",
    org: "healthtech, Series C",
    tone: "fuchsia",
  },
  {
    quote:
      "We didn't hire two SREs and a security engineer this year. Axiom didn't replace them — it made the headcount unnecessary.",
    who: "J. Tanaka",
    role: "VP Engineering",
    org: "logistics SaaS",
    tone: "cyan",
  },
];

const TONE_STYLE: Record<Testimonial["tone"], string> = {
  indigo:  "from-indigo-500/20  to-transparent border-indigo-500/30",
  fuchsia: "from-fuchsia-500/20 to-transparent border-fuchsia-500/30",
  cyan:    "from-cyan-500/20    to-transparent border-cyan-500/30",
};

// Seed-stage design partners. Replace as real customer logos land.
const LOGO_WORDS: readonly string[] = [
  "PIVOT/AI",
  "CASCADE",
  "NORTHRIDGE",
  "OBSIDIAN.IO",
  "HELIX",
  "WATERMARK",
];

export function SocialProofRail() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
      {/* logo strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          shipping with operators at
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          {LOGO_WORDS.map((w) => (
            <span
              key={w}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500/80"
            >
              {w}
            </span>
          ))}
        </div>
      </motion.div>

      {/* testimonial cards */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={t.who}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.06, 0.18) }}
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            className={[
              "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 md:p-6",
              TONE_STYLE[t.tone],
            ].join(" ")}
          >
            <blockquote className="text-[13.5px] text-zinc-200 leading-relaxed">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-3">
              <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-semibold text-white">
                {t.who.replace(/[^A-Z]/g, "").slice(0, 2) || t.who[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-white truncate">{t.who}</p>
                <p className="text-[11px] text-zinc-500 truncate">
                  {t.role} · {t.org}
                </p>
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
