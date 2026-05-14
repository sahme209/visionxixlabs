"use client";

/**
 * Huly-style cursor-reactive motherboard backdrop.
 *
 * A faint SVG circuit pattern fills the parent container; a soft radial
 * spotlight tracks the cursor + reveals the pattern brighter where the
 * mouse is. When the mouse leaves the container, the spotlight fades out.
 *
 * Pure decoration — `pointer-events: none`, never blocks clicks on
 * underlying content. Drop in behind any hero / section.
 */

import { useEffect, useRef, useState } from "react";

interface MotherboardBackdropProps {
  /** Radius of the spotlight that reveals the pattern. Default 360px. */
  radius?: number;
  /** Tint of the spotlight glow. Default violet. */
  tint?: "violet" | "emerald" | "amber" | "cyan" | "rose" | "neutral";
  /** Base opacity of the pattern when cursor is outside. Default 0.04. */
  baseOpacity?: number;
  /** Peak opacity at the spotlight centre. Default 0.20. */
  peakOpacity?: number;
  /** Optional className for the wrapper. */
  className?: string;
}

const TINT_RGB: Record<NonNullable<MotherboardBackdropProps["tint"]>, string> = {
  violet:  "139, 92, 246",
  emerald: "52, 211, 153",
  amber:   "245, 158, 11",
  cyan:    "34, 211, 238",
  rose:    "244, 114, 182",
  neutral: "200, 200, 220",
};

export function MotherboardBackdrop({
  radius = 360,
  tint = "violet",
  baseOpacity = 0.04,
  peakOpacity = 0.2,
  className = "",
}: MotherboardBackdropProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          setPos({ x: pendingX, y: pendingY });
        });
      }
    };
    const onLeave = () => setPos(null);

    // Bind to the parent (the container the backdrop fills) for accurate
    // local coordinates — the backdrop itself has pointer-events: none.
    const parent = el.parentElement ?? document;
    parent.addEventListener("mousemove", onMove as EventListener);
    parent.addEventListener("mouseleave", onLeave);
    return () => {
      parent.removeEventListener("mousemove", onMove as EventListener);
      parent.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const rgb = TINT_RGB[tint];
  const mask = pos
    ? `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 35%, rgba(0,0,0,0) 75%)`
    : `radial-gradient(circle 200px at 50% 50%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 70%)`;
  const spotlight = pos
    ? `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px, rgba(${rgb}, ${peakOpacity}) 0%, rgba(${rgb}, 0) 60%)`
    : "transparent";

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
    >
      {/* Base pattern at low opacity — always visible, gives the surface a hint of texture */}
      <div
        className="absolute inset-0"
        style={{
          opacity: baseOpacity,
          backgroundImage: PATTERN_DATA_URI(rgb),
          backgroundSize: "180px 180px",
          backgroundPosition: "0 0",
        }}
      />
      {/* Cursor-revealed brighter pattern — only renders where the spotlight mask allows */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: pos ? 1 : 0,
          backgroundImage: PATTERN_DATA_URI(rgb),
          backgroundSize: "180px 180px",
          backgroundPosition: "0 0",
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      />
      {/* Soft tinted spotlight overlay sitting on top of the pattern */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: pos ? 1 : 0,
          background: spotlight,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pattern — an SVG circuit board, base64-encoded so it works in any browser
// without an external request. 180×180 px tile that includes traces, vias,
// and labelled pads — same density Huly's hero uses.
// ---------------------------------------------------------------------------

function PATTERN_DATA_URI(rgb: string): string {
  const stroke = `rgba(${rgb}, 0.9)`;
  const fill = `rgba(${rgb}, 0.7)`;
  const dim = `rgba(${rgb}, 0.45)`;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <g fill="none" stroke="${stroke}" stroke-width="0.6">
    <!-- main grid traces -->
    <path d="M0 30 H60 V60 H90 V30 H180" />
    <path d="M0 90 H40 V120 H120 V60 H180" />
    <path d="M0 150 H30 V120 H60 V90 H180" />
    <path d="M30 0 V30 M90 0 V30 M150 0 V60 M60 180 V120 M150 180 V120 M120 60 V0" />
    <!-- diagonals + bus -->
    <path d="M150 60 L120 90 L60 90" />
    <path d="M40 120 L60 100 L100 100" />
  </g>
  <!-- vias (small filled dots) -->
  <g fill="${fill}">
    <circle cx="30" cy="30"  r="1.4" />
    <circle cx="60" cy="60"  r="1.4" />
    <circle cx="90" cy="30"  r="1.4" />
    <circle cx="120" cy="60" r="1.4" />
    <circle cx="40" cy="90"  r="1.4" />
    <circle cx="40" cy="120" r="1.4" />
    <circle cx="120" cy="120" r="1.4" />
    <circle cx="60" cy="120" r="1.4" />
    <circle cx="150" cy="60" r="1.4" />
    <circle cx="150" cy="120" r="1.4" />
  </g>
  <!-- chip pad -->
  <g fill="none" stroke="${dim}" stroke-width="0.5">
    <rect x="68" y="68" width="44" height="44" rx="3" />
    <rect x="76" y="76" width="28" height="28" rx="1.5" />
  </g>
  <g fill="${dim}" font-family="ui-monospace,monospace" font-size="3.2" letter-spacing="0.5">
    <text x="78" y="86">AXIOM</text>
    <text x="78" y="98">A1·24</text>
  </g>
</svg>`.trim();
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
