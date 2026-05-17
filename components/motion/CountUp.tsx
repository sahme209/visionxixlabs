"use client";

/**
 * Animated counter — the Huly "numbers roll up when they appear" effect.
 * Uses IntersectionObserver to start counting only when the number enters
 * the viewport. Eases with a cubic-out curve so it feels organic, not
 * mechanical.
 *
 * Respects `prefers-reduced-motion`: renders the final value immediately.
 */

import { useEffect, useRef, useState } from "react";

export interface CountUpProps {
  /** Target value to count to. */
  to: number;
  /** Starting value (defaults to 0 — or the first value seen if `from === undefined` and the user is reducing motion). */
  from?: number;
  /** Animation duration in ms. */
  duration?: number;
  /** Decimal places. */
  decimals?: number;
  /** Optional prefix (e.g. "$"). */
  prefix?: string;
  /** Optional suffix (e.g. "%"). */
  suffix?: string;
  /** Format with thousands separators. */
  thousands?: boolean;
  /** Optional class on the span. */
  className?: string;
}

export function CountUp({
  to,
  from = 0,
  duration = 1400,
  decimals = 0,
  prefix = "",
  suffix = "",
  thousands = false,
  className = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState<number>(from);
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(to);
      startedRef.current = true;
      return;
    }
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            animate();
            obs.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);

    function animate() {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // Cubic-out easing — fast start, gentle settle.
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    return () => obs.disconnect();
  }, [to, from, duration]);

  const formatted = thousands
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value.toFixed(decimals);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
