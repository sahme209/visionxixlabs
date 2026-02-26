"use client";

import React from "react";

interface HomeCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Use grid layout for multiple inner cards (like Approvals this week) */
  gridCols?: 1 | 2 | 3;
  /** Optional live/badge indicator */
  badge?: React.ReactNode;
  /** Skip inner card wrapper for custom/complex content */
  noInnerWrap?: boolean;
  /** Optional accent bar color (e.g. "blue", "emerald", "violet") */
  accent?: "blue" | "emerald" | "violet" | "amber" | "indigo";
  id?: string;
  className?: string;
}

/**
 * Approvals-style card for home page consistency.
 * Bold title, subtitle, icon, and structured inner content.
 */
const accentColors: Record<string, string> = {
  blue: "bg-[var(--uscis-blue)]/30",
  emerald: "bg-emerald-500/30",
  violet: "bg-violet-500/30",
  amber: "bg-amber-500/30",
  indigo: "bg-indigo-500/30",
};

export default function HomeCard({
  icon,
  title,
  subtitle,
  children,
  gridCols,
  badge,
  noInnerWrap,
  accent,
  id,
  className = "",
}: HomeCardProps) {
  const accentBar = accent ? accentColors[accent] ?? accentColors.blue : null;
  return (
    <section
      id={id}
      className={`relative rounded-xl border border-[var(--border-color)]/60 bg-[var(--bg-surface)] p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden w-full min-w-0 ${id === "key-dates" ? "scroll-mt-24" : ""} ${className}`}
    >
      {accentBar && <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${accentBar}`} aria-hidden />}
      {/* Header: icon + title + subtitle + badge */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Content: single block or grid of inner cards */}
      {gridCols ? (
        <div
          className={`grid gap-3 sm:gap-4 w-full min-w-0 ${
            gridCols === 1
              ? "grid-cols-1"
              : gridCols === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {children}
        </div>
      ) : noInnerWrap ? (
        <div className="w-full min-w-0">{children}</div>
      ) : (
        <div className="rounded-lg p-4 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50 w-full min-w-0">
          {children}
        </div>
      )}
    </section>
  );
}

/** Inner card for use inside HomeCard when gridCols is set */
export function HomeCardInner({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg p-4 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50 w-full min-w-0 ${className}`}
    >
      {children}
    </div>
  );
}
