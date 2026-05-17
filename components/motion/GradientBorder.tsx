"use client";

/**
 * Animated gradient border — Huly / Linear "premium card with a rotating
 * conic-gradient ring". Pure CSS, no JS animation loop.
 *
 * Uses a conic-gradient inside an absolutely-positioned ring + a mask
 * trick to keep the gradient confined to the border. Rotates via a CSS
 * keyframe.
 *
 * Respects prefers-reduced-motion — the ring still shows but doesn't
 * rotate.
 */

import { useId, type ReactNode } from "react";

export interface GradientBorderProps {
  children: ReactNode;
  /** Border thickness in pixels. */
  thickness?: number;
  /** Inner background colour (matches the page so the inside isn't gradient-coloured). */
  innerBg?: string;
  /** Border radius. */
  radius?: number;
  /** Rotation duration in seconds — lower = faster. */
  durationSec?: number;
  /** Gradient palette. */
  palette?: "violet" | "cyan" | "emerald" | "sunset" | "aurora";
  /** Apply the rotation only on hover (cheaper, calmer). */
  hoverOnly?: boolean;
  /** Optional class on the outer wrapper. */
  className?: string;
}

const PALETTES: Record<NonNullable<GradientBorderProps["palette"]>, string> = {
  violet:   "conic-gradient(from 0deg, rgba(139,92,246,0.55), rgba(232,121,249,0.45), rgba(139,92,246,0.0), rgba(139,92,246,0.55))",
  cyan:     "conic-gradient(from 0deg, rgba(34,211,238,0.55), rgba(52,211,153,0.45), rgba(34,211,238,0.0), rgba(34,211,238,0.55))",
  emerald:  "conic-gradient(from 0deg, rgba(52,211,153,0.55), rgba(34,211,238,0.4), rgba(52,211,153,0.0), rgba(52,211,153,0.55))",
  sunset:   "conic-gradient(from 0deg, rgba(251,191,36,0.55), rgba(232,121,249,0.45), rgba(251,191,36,0.0), rgba(251,191,36,0.55))",
  aurora:   "conic-gradient(from 0deg, rgba(139,92,246,0.5), rgba(232,121,249,0.5), rgba(34,211,238,0.5), rgba(52,211,153,0.5), rgba(139,92,246,0.5))",
};

export function GradientBorder({
  children,
  thickness = 1.5,
  innerBg = "rgb(8 8 12)",
  radius = 16,
  durationSec = 8,
  palette = "violet",
  hoverOnly = false,
  className = "",
}: GradientBorderProps) {
  const id = useId().replace(/[:]/g, "");
  const animName = `gradient-border-${id}`;
  const gradient = PALETTES[palette];

  return (
    <div className={`relative ${className}`} style={{ borderRadius: `${radius}px` }}>
      <style>{`
        @keyframes ${animName} {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .${animName}-ring { animation: none !important; }
        }
        .${animName}-host:hover .${animName}-ring {
          animation-play-state: running;
        }
      `}</style>
      <div
        className={`${animName}-host relative isolate`}
        style={{ borderRadius: `${radius}px` }}
      >
        {/* The rotating gradient layer */}
        <div
          aria-hidden
          className={`${animName}-ring pointer-events-none absolute inset-0`}
          style={{
            borderRadius: `${radius}px`,
            background: gradient,
            animation: `${animName} ${durationSec}s linear infinite`,
            animationPlayState: hoverOnly ? "paused" : "running",
            willChange: "transform",
          }}
        />
        {/* The mask layer punches a hole equal to the inner area, leaving just the border. */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            inset: `${thickness}px`,
            borderRadius: `${radius - thickness}px`,
            background: innerBg,
          }}
        />
        {/* The actual content sits above both layers. */}
        <div
          className="relative"
          style={{
            borderRadius: `${radius - thickness}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
