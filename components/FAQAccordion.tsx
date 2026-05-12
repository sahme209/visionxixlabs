"use client";

import { useState, useEffect } from "react";
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
            className="card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]"
              aria-expanded={isOpen}
              aria-controls={panelId}
            >
              <span className="text-sm md:text-base font-semibold text-white">
                {item.question}
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] text-zinc-400 text-xs transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration, ease: motionConfig.ease }}
                  className="overflow-hidden px-4 md:px-5 pb-4"
                >
                  <div className="mt-1 text-sm text-zinc-400">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
