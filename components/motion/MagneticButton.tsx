"use client";

/**
 * Magnetic button wrapper — the signature Huly "buttons that pull toward
 * the cursor" effect. Wraps any child element (button, link, AnimatedButton)
 * and gently translates it toward the pointer when the cursor is within
 * the hover radius.
 *
 * Implementation notes:
 *  - Pure transform — no layout reads after init. Uses requestAnimationFrame
 *    to coalesce rapid mousemove events.
 *  - Respects `prefers-reduced-motion`: the wrapper renders children unchanged.
 *  - Pointer-events stay on the child — clicks behave exactly as before.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface MagneticButtonProps {
  children: ReactNode;
  /** Maximum pixel pull. Default 8 — feels Huly-subtle. */
  strength?: number;
  /** Hover-radius in pixels — the cursor must be within this distance to attract. */
  radius?: number;
  /** Optional class on the wrapper span. */
  className?: string;
}

export function MagneticButton({
  children,
  strength = 8,
  radius = 120,
  className = "",
}: MagneticButtonProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inner = useRef<HTMLSpanElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const wrap = ref.current;
    const child = inner.current;
    if (!wrap || !child) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        tx = 0;
        ty = 0;
      } else {
        const pull = 1 - dist / radius;
        tx = (dx / dist) * pull * strength;
        ty = (dy / dist) * pull * strength;
      }
      if (!raf) {
        raf = requestAnimationFrame(() => {
          child.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
          raf = 0;
        });
      }
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      child.style.transform = "translate3d(0, 0, 0)";
    };

    window.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion, radius, strength]);

  return (
    <span ref={ref} className={`inline-block ${className}`}>
      <span
        ref={inner}
        className="inline-block will-change-transform transition-transform duration-300 ease-out"
        style={{ transform: "translate3d(0, 0, 0)" }}
      >
        {children}
      </span>
    </span>
  );
}
