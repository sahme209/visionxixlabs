"use client";

/**
 * SpotlightCard — wraps any block in a div that tracks the cursor
 * via two CSS custom properties (`--x`, `--y`) and pairs with the
 * `.spotlight-card` utility in globals.css to render a soft radial
 * wash that follows the pointer.
 *
 * Used for "living dark" card surfaces (huly.io vocabulary). The
 * radial wash is white at ~6% opacity so it never overwhelms the
 * underlying content — it just gives the card a sense of warmth
 * as the user moves over it.
 *
 * Defaults to a centred wash at rest so the effect degrades
 * gracefully on touch.
 */

import { useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

export function SpotlightCard({
  children,
  className,
  style,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Optional HTML tag override (e.g. "section", "article"). */
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement | null>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }, []);

  const Component = as as unknown as React.ElementType;

  return (
    <Component
      ref={(el: HTMLElement | null) => { ref.current = el; }}
      onMouseMove={onMove}
      className={`spotlight-card ${className ?? ""}`}
      style={style}
    >
      {children}
    </Component>
  );
}
