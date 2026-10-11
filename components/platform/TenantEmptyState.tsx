"use client";

/**
 * TenantEmptyState — reusable calm empty-state for fresh tenants.
 *
 * Dashboards (audit, security, traces, etc.) show this card when the
 * tenant hasn't connected a cloud yet. Each instance speaks the same
 * visual language: a tinted card with the surface-specific icon,
 * one or two short sentences, and a primary "Connect first cloud" CTA
 * that drops the user into the guided setup flow.
 *
 * No fabricated counts. No fake records. Just a clear next step.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  PlusCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export interface TenantEmptyStateAction {
  href: string;
  label: string;
  /** Visual prominence — primary is the main CTA, ghost is a secondary link. */
  variant?: "primary" | "ghost";
}

export interface TenantEmptyStateProps {
  /**
   * Already-rendered icon element. Server-component callers pass a
   * pre-rendered JSX node so we don't try to serialize a component
   * function across the server→client boundary.
   * Example: `icon={<BoltIcon className="h-5 w-5" />}`
   */
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  /** Optional secondary line — e.g. "AGI will produce your first audit story automatically once a cloud is connected." */
  agiNote?: string;
  /** Optional CTAs. If omitted, defaults to "Connect first cloud" → /dashboard/connectors. */
  actions?: TenantEmptyStateAction[];
  /** Tone of the gradient/glow. Defaults to "orange". */
  tone?: "orange" | "emerald" | "amber" | "cyan";
}

const TONE_GLOW: Record<NonNullable<TenantEmptyStateProps["tone"]>, string> = {
  orange:  "from-orange-500/[0.05] via-transparent to-amber-500/[0.03]",
  emerald: "from-emerald-500/[0.05] via-transparent to-cyan-500/[0.03]",
  amber: "from-amber-500/[0.05] via-transparent to-orange-500/[0.03]",
  cyan:    "from-cyan-500/[0.05] via-transparent to-orange-500/[0.03]",
};

const TONE_ICON_BG: Record<NonNullable<TenantEmptyStateProps["tone"]>, string> = {
  orange:  "bg-orange-500/10 border-orange-500/25 text-orange-300",
  emerald: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
  amber: "bg-amber-500/10 border-amber-500/25 text-amber-300",
  cyan:    "bg-cyan-500/10 border-cyan-500/25 text-cyan-300",
};

const TONE_PRIMARY_CTA: Record<NonNullable<TenantEmptyStateProps["tone"]>, string> = {
  orange:  "bg-orange-500/15 border-orange-500/30 text-orange-100 hover:bg-orange-500/25",
  emerald: "bg-emerald-500/15 border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/25",
  amber: "bg-amber-500/15 border-amber-500/30 text-amber-100 hover:bg-amber-500/25",
  cyan:    "bg-cyan-500/15 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/25",
};

const TONE_GHOST_CTA: Record<NonNullable<TenantEmptyStateProps["tone"]>, string> = {
  orange:  "text-orange-300 hover:text-orange-100",
  emerald: "text-emerald-300 hover:text-emerald-100",
  amber: "text-amber-300 hover:text-amber-100",
  cyan:    "text-cyan-300 hover:text-cyan-100",
};

export function TenantEmptyState({
  icon,
  eyebrow,
  title,
  description,
  agiNote,
  actions,
  tone = "orange",
}: TenantEmptyStateProps) {
  const ctas: TenantEmptyStateAction[] =
    actions && actions.length > 0
      ? actions
      : [{ href: "/dashboard/connectors", label: "Connect first cloud", variant: "primary" }];

  return (
    <div className={`relative rounded-2xl border border-white/[0.06] bg-gradient-to-br ${TONE_GLOW[tone]} p-8 md:p-10 overflow-hidden`}>
      <div
        className="absolute -top-16 -right-12 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(251, 106, 43,0.08), transparent 60%)" }}
        aria-hidden
      />
      <div className="relative max-w-xl">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl border ${TONE_ICON_BG[tone]} mb-5`}>
          {icon}
        </div>
        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${TONE_GHOST_CTA[tone]}`}>
          {eyebrow}
        </p>
        <h2 className="text-2xl md:text-[28px] font-bold text-white tracking-[-0.03em] leading-tight mb-3">
          {title}
        </h2>
        <p className="text-[14px] text-zinc-400 leading-relaxed mb-5">
          {description}
        </p>
        {agiNote && (
          <div className="flex items-start gap-2 mb-6 rounded-xl border border-white/[0.05] bg-black/30 px-3 py-2.5">
            <SparklesIcon className="h-4 w-4 text-orange-300 shrink-0 mt-0.5" />
            <p className="text-[12px] text-zinc-300 leading-relaxed">{agiNote}</p>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {ctas.map((cta) => {
            if (cta.variant === "ghost") {
              return (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${TONE_GHOST_CTA[tone]}`}
                >
                  {cta.label}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              );
            }
            return (
              <Link
                key={cta.href}
                href={cta.href}
                className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-lg border ${TONE_PRIMARY_CTA[tone]} transition-colors`}
              >
                <PlusCircleIcon className="h-4 w-4" />
                {cta.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
