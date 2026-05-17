"use client";

/**
 * Infinite-scroll marquee — Huly / Vercel / Linear "logo strip that loops
 * forever". Duplicates the children once and animates the wrapper via a
 * CSS keyframe so the seam is invisible.
 *
 * No external dependencies; pure CSS animation (GPU-friendly).
 * Respects prefers-reduced-motion: pauses the animation.
 */

import { useId, type ReactNode } from "react";

export interface MarqueeProps {
  /** The marquee items. Duplicated automatically to make the loop seamless. */
  children: ReactNode;
  /** Duration of one full loop in seconds. Lower = faster. */
  durationSec?: number;
  /** Reverse direction (default scrolls right-to-left). */
  reverse?: boolean;
  /** Pause animation on hover. */
  pauseOnHover?: boolean;
  /** Apply a gradient fade on the left + right edges. */
  fadeEdges?: boolean;
  /** Optional class on the outer wrapper. */
  className?: string;
}

export function Marquee({
  children,
  durationSec = 35,
  reverse = false,
  pauseOnHover = true,
  fadeEdges = true,
  className = "",
}: MarqueeProps) {
  // Unique animation name so multiple marquees can coexist with different speeds.
  const id = useId().replace(/[:]/g, "");
  const animName = `marquee-${id}`;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <style>{`
        @keyframes ${animName} {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(${reverse ? "50%" : "-50%"}, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .${animName}-track { animation: none !important; }
        }
        .${animName}-track:hover {
          animation-play-state: ${pauseOnHover ? "paused" : "running"};
        }
      `}</style>
      <div
        className={`${animName}-track flex w-max gap-8 will-change-transform`}
        style={{
          animation: `${animName} ${durationSec}s linear infinite`,
        }}
      >
        <div className="flex shrink-0 items-center gap-8">{children}</div>
        {/* Duplicate so the loop is seamless — aria-hidden so screen readers don't repeat. */}
        <div className="flex shrink-0 items-center gap-8" aria-hidden>{children}</div>
      </div>

      {fadeEdges && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-axiom-bg to-transparent" aria-hidden />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-axiom-bg to-transparent" aria-hidden />
        </>
      )}
    </div>
  );
}
