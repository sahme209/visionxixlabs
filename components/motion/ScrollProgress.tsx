"use client";

/**
 * ScrollProgress — fixed-top scroll-progress indicator.
 *
 * Subscribes to window scroll, computes the fraction of the
 * document already read, and writes it into the element's
 * `--scroll-progress` CSS variable. The `.scroll-progress-bar`
 * utility in globals.css transforms its scaleX from 0 → 1 based
 * on that variable so motion is GPU-cheap and doesn't trigger
 * layout.
 *
 * Drop on any page (root layout is best) — no props needed.
 */

import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      el.style.setProperty("--scroll-progress", String(progress));
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <div ref={ref} className="scroll-progress-bar" aria-hidden />;
}
