"use client";

/**
 * Dripping beam — the cinematic "light is dripping in" effect.
 *
 * A vertical column of soft light with luminescent droplets that slide
 * downward leaving a comet trail. The beam itself slowly pulses; the
 * droplets are staggered so the effect never repeats predictably.
 *
 * Pure CSS — uses keyframe animations + radial gradients. No JS loop.
 * Respects prefers-reduced-motion (shows a static beam, no drops).
 */

import { useId, useMemo } from "react";

export interface DrippingBeamProps {
  /** Number of droplets to drip down the beam. More = denser rain. */
  dropCount?: number;
  /** Total beam height — Tailwind class. */
  heightClass?: string;
  /** Total beam width — pixels. */
  width?: number;
  /** Tint colour. */
  tint?: "violet" | "fuchsia" | "cyan" | "emerald" | "amber" | "aurora";
  /** Average droplet travel duration in seconds. Each drop randomises +/-30%. */
  durationSec?: number;
  /** Optional class on the outer wrapper for positioning. */
  className?: string;
}

const TINTS: Record<NonNullable<DrippingBeamProps["tint"]>, { core: string; halo: string; trail: string }> = {
  violet:  { core: "rgba(196, 181, 253, 1)",  halo: "rgba(139, 92, 246, 0.55)",  trail: "rgba(139, 92, 246, 0)" },
  fuchsia: { core: "rgba(245, 208, 254, 1)",  halo: "rgba(232, 121, 249, 0.55)", trail: "rgba(232, 121, 249, 0)" },
  cyan:    { core: "rgba(165, 243, 252, 1)",  halo: "rgba(34, 211, 238, 0.55)",  trail: "rgba(34, 211, 238, 0)" },
  emerald: { core: "rgba(167, 243, 208, 1)",  halo: "rgba(52, 211, 153, 0.55)",  trail: "rgba(52, 211, 153, 0)" },
  amber:   { core: "rgba(254, 230, 138, 1)",  halo: "rgba(251, 191, 36, 0.55)",  trail: "rgba(251, 191, 36, 0)" },
  aurora:  { core: "rgba(255, 255, 255, 1)",  halo: "rgba(139, 92, 246, 0.55)",  trail: "rgba(34, 211, 238, 0)" },
};

export function DrippingBeam({
  dropCount = 6,
  heightClass = "h-[500px]",
  width = 6,
  tint = "violet",
  durationSec = 3.6,
  className = "",
}: DrippingBeamProps) {
  const id = useId().replace(/[:]/g, "");
  const colors = TINTS[tint];

  // Pre-compute per-droplet timing so the seam is invisible.
  const drops = useMemo(() => {
    const out: { delay: number; duration: number; size: number; horiz: number }[] = [];
    for (let i = 0; i < dropCount; i++) {
      // deterministic-ish pseudo-randomness so SSR + client match.
      const seed = (i + 1) * 0.6180339887 % 1;       // golden ratio decimals
      const seed2 = ((i + 1) * 1.4142135624) % 1;    // sqrt 2 decimals
      out.push({
        delay: -(seed * durationSec),                 // negative delays seed the loop staggered
        duration: durationSec * (0.85 + seed2 * 0.4), // 0.85x .. 1.25x
        size: 4 + Math.floor(seed2 * 6),              // 4..10 px
        horiz: -2 + seed * 4,                          // tiny horizontal jitter
      });
    }
    return out;
  }, [dropCount, durationSec]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none relative ${heightClass} ${className}`}
      style={{ width: `${width * 14}px` }}
    >
      <style>{`
        @keyframes ${id}-drip {
          0%   { transform: translate3d(var(--dx, 0px), -10%, 0); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translate3d(var(--dx, 0px), 110%, 0); opacity: 0; }
        }
        @keyframes ${id}-shimmer {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.92; }
        }
        @media (prefers-reduced-motion: reduce) {
          .${id}-drop { animation: none !important; opacity: 0 !important; }
          .${id}-core { animation: none !important; opacity: 0.55 !important; }
        }
      `}</style>

      {/* Core vertical beam — soft gradient column. */}
      <div
        className={`${id}-core absolute left-1/2 top-0 -translate-x-1/2 h-full`}
        style={{
          width: `${width}px`,
          background: `linear-gradient(to bottom, transparent 0%, ${colors.halo} 18%, ${colors.halo} 82%, transparent 100%)`,
          filter: "blur(2px)",
          animation: `${id}-shimmer 4.8s ease-in-out infinite`,
          willChange: "opacity",
        }}
      />

      {/* Outer halo column for extra glow. */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 h-full opacity-50"
        style={{
          width: `${width * 6}px`,
          background: `radial-gradient(ellipse at center, ${colors.halo} 0%, transparent 70%)`,
          filter: "blur(8px)",
        }}
      />

      {/* Droplets — each runs the same keyframe at a different phase. */}
      {drops.map((d, i) => (
        <span
          key={i}
          className={`${id}-drop absolute left-1/2`}
          style={{
            top: 0,
            ["--dx" as string]: `${d.horiz.toFixed(2)}px`,
            transform: `translate3d(${d.horiz.toFixed(2)}px, -10%, 0)`,
            width: `${d.size}px`,
            height: `${d.size * 2.4}px`,
            marginLeft: `-${d.size / 2}px`,
            borderRadius: "999px",
            background: `radial-gradient(ellipse at center top, ${colors.core} 0%, ${colors.halo} 30%, ${colors.trail} 80%)`,
            boxShadow: `0 0 12px ${colors.halo}, 0 0 22px ${colors.halo}`,
            opacity: 0,
            animation: `${id}-drip ${d.duration.toFixed(2)}s linear ${d.delay.toFixed(2)}s infinite`,
            willChange: "transform, opacity",
            filter: "blur(0.5px)",
          }}
        />
      ))}
    </div>
  );
}
