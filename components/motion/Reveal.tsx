"use client";

import { useEffect, useState } from "react";
import { motion, type MotionProps } from "framer-motion";
import { motionConfig, motionViewport, prefersReducedMotionQuery } from "@/lib/motion/tokens";

type Direction = "up" | "down" | "left" | "right" | "none";

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: Direction;
  blur?: boolean;
  once?: boolean;
  amount?: number;
} & Omit<MotionProps, "initial" | "whileInView" | "viewport">;

export function Reveal({
  children,
  delay = 0,
  duration,
  direction = "up",
  blur = false,
  once,
  amount,
  ...rest
}: RevealProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const baseOffset = 24;
  const offset = (() => {
    switch (direction) {
      case "up":
        return { y: baseOffset, x: 0 };
      case "down":
        return { y: -baseOffset, x: 0 };
      case "left":
        return { x: baseOffset, y: 0 };
      case "right":
        return { x: -baseOffset, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  })();

  const style = blur ? { filter: "blur(8px)" } : undefined;

  if (reduceMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      {...rest}
      initial={{ opacity: 0, ...offset, ...(blur ? style : {}) }}
      whileInView={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: duration ?? motionConfig.duration,
        ease: motionConfig.ease,
        delay,
      }}
      viewport={{
        ...(motionViewport as { once: boolean; amount: number }),
        ...(once != null ? { once } : {}),
        ...(amount != null ? { amount } : {}),
      }}
    >
      {children}
    </motion.div>
  );
}

