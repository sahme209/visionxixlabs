"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { motionConfig, prefersReducedMotionQuery } from "@/lib/motion/tokens";

type FAQItem = { question: string; answer: string };

type FAQAccordionProps = {
  items: FAQItem[];
};

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const duration = reduceMotion ? 0 : motionConfig.duration;

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `faq-panel-${idx}`;
        return (
          <div
            key={item.question}
            className={`relative rounded-xl transition-all duration-300 ${
              isOpen
                ? "faq-expanded surface-frost"
                : "surface-glass"
            }`}
          >
            {/* Gradient indicator on left side */}
            <div className="faq-gradient-indicator" aria-hidden />

            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]"
              aria-expanded={isOpen}
              aria-controls={panelId}
            >
              <span className="text-sm md:text-base font-semibold text-white">
                {item.question}
              </span>
              <motion.span
                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] text-zinc-400 text-xs shrink-0"
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: {
                      duration: reduceMotion ? 0 : 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    },
                    opacity: {
                      duration: reduceMotion ? 0 : 0.25,
                      delay: reduceMotion ? 0 : 0.1,
                    },
                  }}
                  className="overflow-hidden px-4 md:px-5 pb-4"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.3,
                      delay: reduceMotion ? 0 : 0.12,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="mt-1 text-sm text-zinc-400 leading-relaxed"
                  >
                    {item.answer}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
