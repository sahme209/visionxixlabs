"use client";

/**
 * Huly-style magnetic card: a wrapper that adds a cursor-following soft
 * spotlight + subtle 3D tilt on hover. The cursor "magnetises" the card —
 * a faint bright spot tracks the mouse and the surface tilts a few
 * degrees toward it.
 *
 * Drop-in: wrap any existing card. The wrapper is `relative` so the
 * spotlight overlay can absolutely position inside it. Children stay
 * exactly where they were.
 */

import { useRef, useState } from "react";

interface MagneticCardProps {
  children: React.ReactNode;
  /** Max tilt in degrees on each axis. Default 4. */
  maxTilt?: number;
  /** Spotlight radius in px. Default 220. */
  radius?: number;
  /** Tint of the spotlight. */
  tint?: "violet" | "emerald" | "amber" | "cyan" | "rose";
  /** Override className on the wrapper. */
  className?: string;
  /** Optional element to render as (default div). */
  as?: "div" | "a";
  /** When `as === "a"`, the href. */
  href?: string;
}

const RGB: Record<NonNullable<MagneticCardProps["tint"]>, string> = {
  violet:  "139, 92, 246",
  emerald: "52, 211, 153",
  amber:   "245, 158, 11",
  cyan:    "34, 211, 238",
  rose:    "244, 114, 182",
};

export function MagneticCard({
  children,
  maxTilt = 4,
  radius = 220,
  tint = "violet",
  className = "",
  as = "div",
  href,
}: MagneticCardProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; tiltX: number; tiltY: number } | null>(null);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Normalised offset from centre, -1..1
    const nx = (x / rect.width) * 2 - 1;
    const ny = (y / rect.height) * 2 - 1;
    setPos({
      x,
      y,
      // Tilt away from the cursor: cursor in top-right → tilt forward/right
      tiltX: -ny * maxTilt,
      tiltY: nx * maxTilt,
    });
  };
  const onLeave = () => setPos(null);

  const spotlight = pos
    ? `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px, rgba(${RGB[tint]}, 0.20) 0%, rgba(${RGB[tint]}, 0) 65%)`
    : "transparent";
  const transform = pos
    ? `perspective(900px) rotateX(${pos.tiltX}deg) rotateY(${pos.tiltY}deg) translateZ(0)`
    : "perspective(900px) rotateX(0) rotateY(0) translateZ(0)";

  const baseStyle: React.CSSProperties = {
    transform,
    transformStyle: "preserve-3d",
    transition: pos ? "transform 80ms ease-out" : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
  };

  const inner = (
    <>
      {children}
      {/* Spotlight overlay — sits above content but pointer-events: none so clicks pass through */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-200"
        style={{
          opacity: pos ? 1 : 0,
          background: spotlight,
          mixBlendMode: "screen",
        }}
      />
    </>
  );

  if (as === "a" && href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={`relative block ${className}`}
        style={baseStyle}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative ${className}`}
      style={baseStyle}
    >
      {inner}
    </div>
  );
}
