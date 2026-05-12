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

const baseClasses =
  "btn-shimmer focus-ring-animated inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all";

const variantClasses: Record<Variant, string> = {
  primary:
    "px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
  secondary:
    "px-6 py-3 bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm",
  ghost:
    "px-4 py-2 border border-white/[0.08] text-zinc-300 bg-white/[0.02] hover:bg-white/[0.05] hover:shadow-[inset_0_0_20px_rgba(124,58,237,0.06)]",
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: motionConfig.duration, ease: motionConfig.ease }}
      className={cls}
      onClick={onClick as any}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
