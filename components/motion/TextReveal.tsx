"use client";

/**
 * Split-text reveal — the Huly "letters fly in from below" hero effect.
 *
 * Renders the provided text split into characters or words, each one
 * fading + sliding from below with a small per-element delay. Triggered
 * by IntersectionObserver so it fires once when scrolled into view.
 *
 * Respects prefers-reduced-motion: renders the text statically.
 */

import { useEffect, useRef, useState } from "react";

export interface TextRevealProps {
  /** Plain text to reveal — JSX children are not supported (use multiple TextReveal blocks). */
  text: string;
  /** Split unit. `char` = per character (Huly hero feel); `word` = per word (cleaner for long copy). */
  splitBy?: "char" | "word";
  /** Per-element stagger in ms. */
  stagger?: number;
  /** Each element's own animation duration in ms. */
  duration?: number;
  /** Optional delay before the whole reveal starts. */
  startDelay?: number;
  /** Tailwind class applied to the wrapper. */
  className?: string;
  /** Optional element to render as the wrapper (default span). Pass "h1" / "h2" etc to preserve semantics. */
  as?: keyof React.JSX.IntrinsicElements;
}

export function TextReveal({
  text,
  splitBy = "char",
  stagger = 26,
  duration = 620,
  startDelay = 0,
  className = "",
  as = "span",
}: TextRevealProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduce);
    if (reduce) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const parts: string[] = splitBy === "word"
    ? text.split(/(\s+)/)            // keep whitespace as its own slot
    : Array.from(text);              // grapheme-aware enough for ASCII + emoji

  const Wrapper = as as keyof React.JSX.IntrinsicElements;

  return (
    <Wrapper
      ref={ref as React.Ref<HTMLSpanElement>}
      className={className}
      aria-label={text}
    >
      {parts.map((p, i) => {
        // Whitespace renders unchanged so the layout doesn't collapse.
        if (/^\s+$/.test(p)) return <span key={i} aria-hidden>{p}</span>;
        const baseDelay = startDelay + i * stagger;
        return (
          <span
            key={i}
            aria-hidden
            className="inline-block will-change-transform"
            style={{
              opacity: visible || reducedMotion ? 1 : 0,
              transform: visible || reducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 0.6em, 0)",
              transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${baseDelay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${baseDelay}ms`,
            }}
          >
            {p}
          </span>
        );
      })}
    </Wrapper>
  );
}
