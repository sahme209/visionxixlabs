"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { AccentMarker } from "@/components/ui/AccentMarker";
import { motionConfig, prefersReducedMotionQuery } from "@/lib/motion/tokens";

const TESTIMONIALS = [
  {
    quote:
      "Axiom found cost savings we'd been missing for months and generated the Terraform to fix it. The approval workflow gave us confidence to actually apply it.",
    author: "Head of Infrastructure",
    company: "SaaS",
    color: "violet" as const,
  },
  {
    quote:
      "The cognitive reasoning is what sets it apart — it doesn't just list findings, it prioritizes them and explains why. Like having a senior cloud engineer on call 24/7.",
    author: "VP Engineering",
    company: "Scale-up",
    color: "fuchsia" as const,
  },
  {
    quote:
      "Read-only by default, approval gates on every change, full audit trail. It's the only AI tool our security team approved without a fight.",
    author: "CTO",
    company: "Enterprise",
    color: "indigo" as const,
  },
  {
    quote:
      "We connected our AWS account and had a prioritized findings report in under a minute. The execution plans with rollback strategies are exactly what we needed.",
    author: "Cloud Architect",
    company: "B2B",
    color: "emerald" as const,
  },
];

export function TestimonialsCarousel() {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const t = TESTIMONIALS[index];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <AccentMarker color="violet" size="md" />
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Trusted by teams running production infrastructure
          </h2>
        </div>
        <p className="text-center text-zinc-400 mb-12 max-w-2xl mx-auto">
          Engineers who let Axiom operate their cloud with confidence.
        </p>

        <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
          <div className="grid md:grid-cols-2 min-h-[220px]">
            {/* Left: accent panel */}
            <div
              className={`p-8 flex flex-col justify-center ${
                t.color === "violet"
                  ? "bg-violet-500/[0.06]"
                  : t.color === "fuchsia"
                    ? "bg-fuchsia-500/[0.06]"
                    : t.color === "indigo"
                      ? "bg-indigo-500/[0.06]"
                      : "bg-emerald-500/[0.06]"
              }`}
            >
              <AccentMarker color={t.color} size="md" className="mb-4" />
              <p className="text-sm font-semibold text-zinc-200">
                {t.author}
              </p>
              <p className="text-xs text-zinc-500">{t.company}</p>
            </div>
            {/* Right: quote */}
            <div className="p-8 flex flex-col justify-center bg-white/[0.02]">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={index}
                  initial={reduceMotion ? {} : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: motionConfig.duration, ease: motionConfig.ease }}
                  className="text-lg md:text-xl text-zinc-300 italic leading-relaxed"
                >
                  &ldquo;{t.quote}&rdquo;
                </motion.blockquote>
              </AnimatePresence>
            </div>
          </div>

          {/* Carousel controls */}
          <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setIndex((i) => (i === 0 ? TESTIMONIALS.length - 1 : i - 1))}
              className="p-2 rounded-xl text-zinc-400 hover:bg-white/[0.04] hover:text-violet-400 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index
                      ? "w-6 bg-violet-500"
                      : "w-2 bg-zinc-700 hover:bg-zinc-600"
                  }`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => (i === TESTIMONIALS.length - 1 ? 0 : i + 1))}
              className="p-2 rounded-xl text-zinc-400 hover:bg-white/[0.04] hover:text-violet-400 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
