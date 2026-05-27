"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode, MouseEventHandler } from "react";
import { motionConfig, prefersReducedMotionQuery } from "@/lib/motion/tokens";
import { useEffect, useState } from "react";

type Variant = "primary" | "secondary" | "ghost";

type BaseProps = {
  variant?: Variant;
  children: ReactNode;
  href?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

/* Apple-grade base: tactile press physics provided by .btn-press /
   .btn-ghost-press in globals.css. We layer in focus-ring-animated for
   keyboard navigation, and switch from uppercase + tracking-wide to
   tracking-tight (Huly/Apple feel — uppercase reads as software,
   sentence case reads as product). */
const baseClasses =
  "focus-ring-animated inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight";

const variantClasses: Record<Variant, string> = {
  /* White tactile press with coral aura on hover */
  primary:
    "btn-press px-7 py-3",
  /* Ghost tactile press — same physics, no fill */
  secondary:
    "btn-ghost-press px-7 py-3",
  /* Smaller variant with the same ghost physics */
  ghost:
    "btn-ghost-press px-5 py-2.5",
};

export function AnimatedButton({ variant = "primary", href, className = "", children, onClick, disabled }: BaseProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mq.matches);
    const onChange = (ev: MediaQueryListEvent) => setReduceMotion(ev.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cls = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {reduceMotion ? (
          children
        ) : (
          <motion.span
            className="inline-flex items-center justify-center gap-2"
            /* .btn-press already handles hover lift + active press in CSS.
               framer-motion just adds a subtle tap feedback on touch. */
            whileTap={{ scale: 0.985 }}
            transition={{ duration: motionConfig.duration, ease: motionConfig.ease }}
          >
            {children}
          </motion.span>
        )}
      </Link>
    );
  }

  if (reduceMotion) {
    return (
      <button className={cls} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      transition={{ duration: motionConfig.duration, ease: motionConfig.ease }}
      className={cls}
      onClick={onClick as any}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
