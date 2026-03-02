"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { motionConfig, prefersReducedMotionQuery } from "@/lib/motion/tokens";
import { useEffect, useState } from "react";

type HoverCardProps = {
  children: ReactNode;
  className?: string;
  /** When true, only adds hover motion—no card styling (use to wrap existing cards) */
  minimal?: boolean;
};

export function HoverCard({ children, className = "", minimal }: HoverCardProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mq.matches);
    const onChange = (ev: MediaQueryListEvent) => setReduceMotion(ev.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const base = minimal
    ? ""
    : "rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/70 backdrop-blur shadow-sm transition-colors";

  if (reduceMotion) {
    return <div className={`${base} ${className}`.trim()}>{children}</div>;
  }

  return (
    <motion.div
      className={`${base} ${className}`.trim() || undefined}
      whileHover={{
        y: -4,
        boxShadow: "0 18px 45px rgba(15,23,42,0.28)",
      }}
      whileTap={{ y: 0 }}
      transition={{ duration: motionConfig.duration, ease: motionConfig.ease }}
    >
      {children}
    </motion.div>
  );
}

