"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { AccentMarker } from "@/components/ui/AccentMarker";
import { motionConfig, prefersReducedMotionQuery } from "@/lib/motion/tokens";

const TESTIMONIALS = [
  {
    quote:
      "The AI assistant handles 80% of our support tickets. Our team can focus on complex cases.",
    author: "Head of Support",
    company: "SaaS",
    color: "violet" as const,
  },
  {
    quote:
      "Lead capture and escalation to human are game-changers. We convert more visitors.",
    author: "Product Lead",
    company: "B2B",
    color: "fuchsia" as const,
  },
  {
    quote:
      "Enterprise security and API access — exactly what we needed to integrate with our stack.",
    author: "CTO",
    company: "Enterprise",
    color: "indigo" as const,
  },
  {
    quote:
      "Production-ready infrastructure and clear handover. We own the platform from day one.",
    author: "VP Engineering",
    company: "Scale-up",
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
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Trusted by teams shipping production systems
          </h2>
        </div>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto">
          Engineering-led engagements with clear outcomes and handover.
        </p>

        {/* Split two-tone panel */}
        <div className="rounded-3xl overflow-hidden border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/50">
          <div className="grid md:grid-cols-2 min-h-[220px]">
            {/* Left: accent panel */}
            <div
              className={`p-8 flex flex-col justify-center ${
                t.color === "violet"
                  ? "bg-violet-50 dark:bg-violet-950/50"
                  : t.color === "fuchsia"
                    ? "bg-fuchsia-50 dark:bg-fuchsia-950/50"
                    : t.color === "indigo"
                      ? "bg-indigo-50 dark:bg-indigo-950/50"
                      : "bg-emerald-50 dark:bg-emerald-950/50"
              }`}
            >
              <AccentMarker color={t.color} size="md" className="mb-4" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t.author}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.company}</p>
            </div>
            {/* Right: quote */}
            <div className="p-8 flex flex-col justify-center bg-white dark:bg-slate-900">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={index}
                  initial={reduceMotion ? {} : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: motionConfig.duration, ease: motionConfig.ease }}
                  className="text-lg md:text-xl text-slate-700 dark:text-slate-300 italic leading-relaxed"
                >
                  &ldquo;{t.quote}&rdquo;
                </motion.blockquote>
              </AnimatePresence>
            </div>
          </div>

          {/* Carousel controls */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIndex((i) => (i === 0 ? TESTIMONIALS.length - 1 : i - 1))}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
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
                      ? "w-6 bg-violet-600 dark:bg-violet-500"
                      : "w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400"
                  }`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => (i === TESTIMONIALS.length - 1 ? 0 : i + 1))}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
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
