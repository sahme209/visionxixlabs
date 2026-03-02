"use client";

import { motion, type Variants } from "framer-motion";
import { motionConfig, motionViewport, prefersReducedMotionQuery } from "@/lib/motion/tokens";
import { useEffect, useState } from "react";

type StaggerProps = {
  children: React.ReactNode;
  delay?: number;
  interval?: number;
};

export function Stagger({ children, delay = 0, interval = 0.06 }: StaggerProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  if (reduceMotion) {
    return <div>{children}</div>;
  }

  const variants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: motionConfig.duration,
        ease: motionConfig.ease,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      transition={{
        delayChildren: delay,
        staggerChildren: interval,
      }}
    >
      {Array.isArray(children)
        ? (children as React.ReactNode[]).map((child, idx) => (
            <motion.div key={idx} variants={variants}>
              {child}
            </motion.div>
          ))
        : <motion.div variants={variants}>{children}</motion.div>}
    </motion.div>
  );
}

