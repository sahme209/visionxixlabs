"use client";

/**
 * 3D tilt card — the Huly / Linear "card subtly leans toward the cursor"
 * effect. Wrap any card-like child; the wrapper applies a perspective
 * rotation based on the pointer's relative position inside the card.
 *
 * Pure CSS 3D transform, GPU-accelerated. Includes an optional glare
 * highlight that tracks the cursor for extra depth.
 *
 * Respects prefers-reduced-motion (renders the child statically).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface TiltCardProps {
  children: ReactNode;
  /** Max tilt in degrees on each axis. Default 8 — looks Huly-subtle. */
  maxTilt?: number;
  /** Subtle scale on hover (1 = no scale). Default 1.015. */
  scale?: number;
  /** Render a soft glare highlight that follows the cursor. */
  glare?: boolean;
  /** Class on the outer wrapper (Tailwind etc). */
  className?: string;
}

export function TiltCard({
  children,
  maxTilt = 8,
  scale = 1.015,
  glare = true,
  className = "",
}: TiltCardProps) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const el = wrap.current;
    const child = inner.current;
    if (!el || !child) return;

    let raf = 0;
    let rx = 0;
    let ry = 0;
    let s = 1;
    let gX = 50;
    let gY = 50;
    let gOp = 0;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;   // 0..1
      const py = (e.clientY - rect.top) / rect.height;   // 0..1
      ry = (px - 0.5) * 2 * maxTilt;                     // rotateY
      rx = -(py - 0.5) * 2 * maxTilt;                    // rotateX (inverted so card tilts toward cursor)
      s = scale;
      gX = px * 100;
      gY = py * 100;
      gOp = 0.55;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      rx = 0; ry = 0; s = 1; gOp = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const apply = () => {
      child.style.transform =
        `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      if (glareRef.current) {
        glareRef.current.style.background =
          `radial-gradient(circle at ${gX}% ${gY}%, rgba(255,255,255,${gOp.toFixed(2)}) 0%, transparent 50%)`;
      }
      raf = 0;
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion, maxTilt, scale]);

  return (
    <div ref={wrap} className={`relative ${className}`} style={{ perspective: "900px" }}>
      <div
        ref={inner}
        className="relative will-change-transform transition-transform duration-300 ease-out"
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
        {glare && (
          <div
            ref={glareRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-90 mix-blend-overlay transition-opacity duration-300"
          />
        )}
      </div>
    </div>
  );
}
