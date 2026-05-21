/**
 * <PlatformHero/> — reusable hero strip for the new platform surfaces.
 *
 * Same visual treatment as the dashboard command center but driven by
 * props so each surface (sub-tools, automation, desktop agents, models,
 * gaps, learning) renders with consistent structure: eyebrow + title +
 * description + optional chips on the right.
 */

import type { ReactNode } from "react";

interface PlatformHeroProps {
  eyebrow: string;
  eyebrowTone?: "violet" | "cyan" | "fuchsia" | "emerald" | "amber";
  title: string;
  description: string;
  /** Optional right-side chips / actions. */
  right?: ReactNode;
  /** Optional gradient hint — pass a Tailwind from-… to-… class. */
  gradientFromColor?: string;
}

const EYEBROW_TONES = {
  violet:   "text-violet-300/80",
  cyan:     "text-cyan-300/80",
  fuchsia:  "text-fuchsia-300/80",
  emerald:  "text-emerald-300/80",
  amber:    "text-amber-300/80",
} as const;

export function PlatformHero({
  eyebrow,
  eyebrowTone = "violet",
  title,
  description,
  right,
  gradientFromColor,
}: PlatformHeroProps) {
  const gradient =
    gradientFromColor ??
    "radial-gradient(900px 320px at 14% 0%, rgba(124,58,237,0.12), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(45,212,191,0.06), transparent 60%)";

  return (
    <div className="mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent p-6 md:p-8 relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
        style={{ background: gradient }}
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className={["text-[10px] font-mono uppercase tracking-[0.22em]", EYEBROW_TONES[eyebrowTone]].join(" ")}>
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.03em]">{title}</h1>
          <p className="mt-3 max-w-2xl text-[14px] text-zinc-400 leading-relaxed">{description}</p>
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
    </div>
  );
}
