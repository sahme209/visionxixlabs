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
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500 focus-visible:ring-offset-[#09090b] transition-colors";

const variantClasses: Record<Variant, string> = {
  primary:
    "px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30",
  secondary:
    "px-6 py-3 bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm",
  ghost:
    "px-4 py-2 border border-white/[0.08] text-zinc-300 bg-white/[0.02] hover:bg-white/[0.05]",
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
