"use client";

/**
 * ScrollRevealText — words fade in one at a time as the paragraph
 * scrolls into view (huly.io 'Our Custom Plan…' effect).
 *
 * Behavior: each word gets an opacity tied to how far the paragraph
 * has scrolled past a reveal anchor (default 70% of viewport
 * height). Words further down in the paragraph wake up later. The
 * full paragraph lands at full opacity by the time the bottom of
 * the paragraph clears the anchor line.
 *
 * Costs almost nothing — one rAF-throttled scroll listener, opacity
 * writes only (no layout thrash). Pairs with the .scroll-reveal-text
 * utility in globals.css for the cubic-bezier smoothing transition.
 */

import { useEffect, useRef, useState } from "react";

export function ScrollRevealText({
  text,
  className,
  /** Fraction of viewport height (from top) where the reveal anchor sits. 0.7 = 70% down. */
  anchor = 0.72,
  /** Minimum opacity for unread words. Slightly visible so layout doesn't pop. */
  restOpacity = 0.18,
  /** Acceleration multiplier — how aggressively the wave moves through the words. */
  speed = 2.2,
  /** Element tag override. */
  as = "p",
}: {
  text: string;
  className?: string;
  anchor?: number;
  restOpacity?: number;
  speed?: number;
  as?: "p" | "h2" | "h3" | "div";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;
    const compute = () => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const winH = window.innerHeight || 1;
      const anchorY = winH * anchor;
      // 0 when paragraph top reaches the anchor, 1 when bottom clears it.
      const start = anchorY - rect.height;
      const denom = Math.max(1, rect.height);
      const p = (anchorY - rect.top - 0) / denom;
      // Map [start, 0]→[0, 1] roughly, clamp.
      const clamped = Math.max(0, Math.min(1, p));
      // Slight ease so the head/tail of the paragraph aren't both gated.
      setProgress(clamped);
      void start;
      void denom;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", compute);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", compute);
    };
  }, [anchor]);

  const words = text.split(/(\s+)/); // keep whitespace tokens for layout
  const real = words.filter((w) => w.trim().length > 0);
  const total = Math.max(1, real.length);
  let realIdx = -1;

  const Component = as as unknown as React.ElementType;
  return (
    <Component
      ref={(el: HTMLElement | null) => { ref.current = el; }}
      className={`scroll-reveal-text ${className ?? ""}`}
    >
      {words.map((w, i) => {
        if (w.trim().length === 0) return <span key={i}>{w}</span>;
        realIdx += 1;
        const wordStart = realIdx / total;
        const wordProgress = Math.max(0, Math.min(1, (progress - wordStart) * speed));
        const opacity = restOpacity + (1 - restOpacity) * wordProgress;
        return (
          <span key={i} style={{ opacity }}>
            {w}
          </span>
        );
      })}
    </Component>
  );
}
