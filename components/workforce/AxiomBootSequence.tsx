/**
 * AxiomBootSequence — Phase 631.
 *
 * Letter-by-letter glitch entry animation for the portal. Pure CSS
 * keyframes (no Framer Motion dep). Mounts once per session via
 * sessionStorage flag — subsequent navigations skip the animation
 * so it never gets stale.
 *
 * Visual stack:
 *   1. Each letter scales from 0 → 1 with sharp ease-out, staggered
 *      60ms apart. Robotic monospace, emerald accent.
 *   2. After all letters are in, a 400ms glitch burst: RGB chromatic
 *      aberration (cyan-magenta-yellow text-shadow shift) + a single
 *      scan-line wipe traveling top→bottom.
 *   3. Final state: clean white text with a subtle emerald underglow,
 *      hovers for 600ms, then fades the entire sequence out over 500ms.
 *
 * Total duration ~ 2.8s. Honors prefers-reduced-motion (skips to the
 * final state instantly).
 */

"use client";

import { useEffect, useState } from "react";

interface AxiomBootSequenceProps {
  /** Text to animate. Defaults to "VISIONXIXLABS". */
  text?: string;
  /** Optional subtitle that fades in after the main text lands. */
  subtitle?: string;
  /** Forces the animation to run even if seen this session. Useful for the marketing site. */
  forceRun?: boolean;
  /** Called after the animation completes (or skipped because seen-this-session). */
  onComplete?: () => void;
}

const SESSION_KEY = "axiom_boot_sequence_seen_v1";

export function AxiomBootSequence({
  text = "VISIONXIXLABS",
  subtitle,
  forceRun = false,
  onComplete,
}: AxiomBootSequenceProps) {
  const [phase, setPhase] = useState<"hidden" | "running" | "done">("hidden");

  useEffect(() => {
    // Honor seen-this-session unless forced.
    if (!forceRun) {
      const seen = typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY);
      if (seen) {
        setPhase("done");
        onComplete?.();
        return;
      }
    }

    // Honor reduced motion.
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      sessionStorage.setItem(SESSION_KEY, "1");
      onComplete?.();
      return;
    }

    setPhase("running");
    // Letter stagger 60ms × N + 400ms glitch burst + 600ms hover + 500ms fade.
    const totalMs = text.length * 60 + 400 + 600 + 500;
    const t = window.setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem(SESSION_KEY, "1");
      onComplete?.();
    }, totalMs);
    return () => window.clearTimeout(t);
  }, [text.length, forceRun, onComplete]);

  if (phase === "done") return null;

  return (
    <>
      <style jsx>{`
        @keyframes letterDrop {
          0%   { opacity: 0; transform: translateY(-12px) scale(0.6); filter: blur(4px); }
          60%  { opacity: 1; transform: translateY(2px)   scale(1.05); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0)     scale(1);    filter: blur(0); }
        }
        @keyframes glitchShift {
          0%   { text-shadow: 0 0 0 transparent; }
          25%  { text-shadow: -2px 0 #0ff, 2px 0 #f0f, 0 1px #ff0; transform: translateX(-1px); }
          50%  { text-shadow:  3px 0 #0ff, -3px 0 #f0f, 0 -1px #ff0; transform: translateX(2px); }
          75%  { text-shadow: -2px 0 #0ff, 2px 0 #f0f, 0 1px #ff0; transform: translateX(-1px); }
          100% { text-shadow: 0 0 24px rgba(110,231,183,0.55); transform: translateX(0); }
        }
        @keyframes scanLine {
          0%   { transform: translateY(-100%); opacity: 0.0; }
          15%  { opacity: 0.9; }
          85%  { opacity: 0.9; }
          100% { transform: translateY(120vh); opacity: 0.0; }
        }
        @keyframes containerFadeOut {
          0%, 80% { opacity: 1; }
          100%    { opacity: 0; pointer-events: none; }
        }
        @keyframes subtitleFadeIn {
          0%, 60% { opacity: 0; transform: translateY(4px); }
          100%    { opacity: 1; transform: translateY(0); }
        }
        @keyframes underGlow {
          0%, 60% { box-shadow: 0 0 0 transparent; }
          80%     { box-shadow: 0 8px 32px rgba(110,231,183,0.18); }
          100%    { box-shadow: 0 4px 16px rgba(110,231,183,0.08); }
        }
        .vx-container {
          animation: containerFadeOut 2800ms forwards;
        }
        .vx-letter {
          display: inline-block;
          opacity: 0;
          will-change: transform, opacity, filter;
          animation: letterDrop 280ms cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .vx-glitch {
          animation: glitchShift 400ms steps(8, end) forwards;
        }
        .vx-scan {
          animation: scanLine 1200ms linear forwards;
        }
        .vx-subtitle {
          animation: subtitleFadeIn 800ms cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .vx-wordmark {
          animation: underGlow 1400ms cubic-bezier(0.16,1,0.3,1) forwards;
        }
      `}</style>

      <div
        className="vx-container fixed inset-0 z-[99] flex flex-col items-center justify-center bg-black"
        aria-hidden="true"
      >
        {/* Scan-line wipe — single horizontal bar that travels top→bottom
            during the glitch burst. Pure cyan with low opacity. */}
        <div
          className="absolute left-0 right-0 h-[2px] bg-cyan-300/60"
          style={{
            top: 0,
            animation: `scanLine 1200ms linear forwards`,
            animationDelay: `${text.length * 60}ms`,
          }}
        />

        {/* Wordmark — the letters. Each letter drops in with stagger,
            then the whole wordmark glitches once when complete. */}
        <div
          className="vx-wordmark relative px-6 py-3 rounded-lg"
        >
          <h1
            className="font-mono text-[44px] sm:text-[64px] md:text-[80px] font-bold tracking-[0.08em] text-white leading-none"
            style={{
              animation: `glitchShift 400ms steps(8, end) forwards`,
              animationDelay: `${text.length * 60}ms`,
            }}
          >
            {text.split("").map((ch, i) => (
              <span
                key={`${ch}-${i}`}
                className="vx-letter"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h1>

          {/* Sub-line — a thin emerald bar that extends after the
              wordmark lands. Pure decoration, no text. */}
          <div
            className="mt-2 h-[2px] bg-emerald-300/40 mx-auto"
            style={{
              width: 0,
              animation: `subtitleFadeIn 600ms cubic-bezier(0.16,1,0.3,1) forwards`,
              animationDelay: `${text.length * 60 + 200}ms`,
              maxWidth: "100%",
            }}
          />
        </div>

        {subtitle && (
          <p
            className="vx-subtitle mt-6 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.32em] text-emerald-300/70 opacity-0"
            style={{ animationDelay: `${text.length * 60 + 400}ms` }}
          >
            {subtitle}
          </p>
        )}

        {/* Subtle dot grid backdrop — robotic feel, doesn't compete
            with the letters. */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.08]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(110,231,183,0.4) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>
    </>
  );
}
