"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

interface HulyScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Animation style: "up" | "scale" | "fade" */
  animation?: "up" | "scale" | "fade";
  /** Delay before animation starts (ms) */
  delay?: number;
  /** Stagger index for children (0 = no delay) */
  staggerIndex?: number;
}

/**
 * Huly-inspired scroll-triggered reveal animation.
 * Elements animate in as they enter the viewport.
 */
export default function HulyScrollReveal({
  children,
  className = "",
  animation = "up",
  delay = 0,
  staggerIndex = 0,
}: HulyScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseClass = "transition-all duration-700 ease-out";
  const delayMs = delay + staggerIndex * 80;
  const animClass =
    animation === "up"
      ? isVisible
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-8"
      : animation === "scale"
      ? isVisible
        ? "opacity-100 scale-100"
        : "opacity-0 scale-95"
      : isVisible
      ? "opacity-100"
      : "opacity-0";

  return (
    <div
      ref={ref}
      className={`${baseClass} ${animClass} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
