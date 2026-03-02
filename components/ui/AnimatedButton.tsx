"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { motionConfig, prefersReducedMotionQuery } from "@/lib/motion/tokens";
import { useEffect, useState } from "react";

type Variant = "primary" | "secondary" | "ghost";

type BaseProps = {
  variant?: Variant;
  children: ReactNode;
  href?: string;
  className?: string;
} & Omit<ComponentProps<"button">, "type">;

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900 transition-colors";

const variantClasses: Record<Variant, string> = {
  primary:
    "px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40",
  secondary:
    "px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200",
  ghost:
    "px-4 py-2 border border-slate-300/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800",
};

export function AnimatedButton({ variant = "primary", href, className = "", children, ...rest }: BaseProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mq.matches);
    const onChange = (ev: MediaQueryListEvent) => setReduceMotion(ev.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const Component = href ? Link : "button";
  const MotionComp = reduceMotion ? Component : motion(Component as any);

  const motionProps = reduceMotion
    ? {}
    : {
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.97 },
        transition: { duration: motionConfig.duration, ease: motionConfig.ease },
      };

  return (
    <MotionComp
      {...(href ? { href } : {})}
      {...(motionProps as any)}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </MotionComp>
  );
}

