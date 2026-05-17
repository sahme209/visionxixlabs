"use client";

/**
 * Cursor-following spotlight overlay — the signature Huly "light follows
 * you" effect. Renders a soft radial-gradient glow that tracks the mouse
 * across the wrapped region.
 *
 * Pointer-events-none, GPU-friendly (uses CSS transform, no layout work).
 * Falls back to a stationary subtle glow when the user has reduced-motion
 * preference set.
 */

import { useEffect, useRef, useState } from "react";

export interface SpotlightProps {
  /** Tailwind color name used in the radial gradient (e.g. "violet-500"). */
  tint?: "violet" | "fuchsia" | "cyan" | "emerald" | "amber";
  /** Size of the glow in pixels — diameter of the soft circle. */
  size?: number;
  /** Strength of the glow (0..1). */
  intensity?: number;
  /** Optional extra class on the wrapper. */
  className?: string;
}

const TINT_COLORS: Record<NonNullable<SpotlightProps["tint"]>, string> = {
  violet:   "rgba(139, 92, 246, 0.18)",
  fuchsia:  "rgba(232, 121, 249, 0.18)",
  cyan:     "rgba(34, 211, 238, 0.18)",
  emerald:  "rgba(52, 211, 153, 0.18)",
  amber:    "rgba(251, 191, 36, 0.18)",
};

export function Spotlight({
  tint = "violet",
  size = 600,
  intensity = 1,
  className = "",
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5, visible: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // On primary-touch devices (phones / tablets) the cursor-follow effect
    // doesn't make sense — render nothing at all (saves a giant blurred
    // div + rAF loop + listener overhead).
    const touch = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;
    setIsTouch(touch);
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    let raf = 0;
    let nextX = 0.5;
    let nextY = 0.5;

    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      nextX = (e.clientX - rect.left) / rect.width;
      nextY = (e.clientY - rect.top) / rect.height;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          setPos({ x: nextX, y: nextY, visible: true });
          raf = 0;
        });
      }
    };
    const onEnter = () => setPos((p) => ({ ...p, visible: true }));
    const onLeave = () => setPos((p) => ({ ...p, visible: false }));

    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseenter", onEnter);
    parent.addEventListener("mouseleave", onLeave);

    return () => {
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseenter", onEnter);
      parent.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  // On touch devices we render nothing at all — saves a 680x680 blurred
  // div from getting composited every frame.
  if (isTouch) return null;

  const tintColor = TINT_COLORS[tint];
  const radius = size / 2;

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute transition-opacity duration-500 ease-out"
        style={{
          left: 0,
          top: 0,
          width: `${size}px`,
          height: `${size}px`,
          transform: `translate3d(calc(${pos.x * 100}% - ${radius}px), calc(${pos.y * 100}% - ${radius}px), 0)`,
          background: `radial-gradient(circle at center, ${tintColor} 0%, transparent 60%)`,
          opacity: reducedMotion ? 0.45 : pos.visible ? intensity : 0,
          filter: "blur(36px)",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
