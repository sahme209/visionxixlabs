"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSubscription } from "@/hooks/useSubscription";
import {
  SparklesIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  BoltIcon,
  MapIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import { HERO_IMAGES } from "@/lib/images";

const FEATURES = [
  { icon: ChartBarIcon, label: "Your queue position", short: "Queue position" },
  { icon: ClockIcon, label: "Current processing times", short: "Processing times" },
  { icon: ArrowTrendingUpIcon, label: "Daily approval activity", short: "Approval activity" },
  { icon: BriefcaseIcon, label: "Case tools", short: "Case tools" },
  { icon: BoltIcon, label: "Expedite request", short: "Expedite" },
  { icon: MapIcon, label: "Action plan", short: "Action plan" },
] as const;

export default function PremiumUnlockCard() {
  const { hasUsedTrial } = useSubscription();
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.05]">
        <Image src={HERO_IMAGES.statueOfLiberty} alt="" fill className="object-cover" sizes="600px" />
      </div>
      {/* Header - Approvals-style */}
      <div className="relative mb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
            <SparklesIcon className="w-5 h-5 text-[var(--text-primary)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Premium features
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Free: timeline & key dates. Pro: queue position, full stats & case tools.
            </p>
          </div>
        </div>
      </div>

      {/* Feature list - compact, mobile-friendly */}
      <div className="relative">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {FEATURES.map(({ icon: Icon, label, short }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <Icon className="w-4 h-4 text-[var(--text-primary)]" />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)] min-w-0 truncate sm:truncate-none" title={label}>
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </span>
              <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0 ml-auto opacity-60" aria-hidden />
            </li>
          ))}
        </ul>

        {/* Single CTA */}
        <div className="mt-4 sm:mt-5 pt-4 border-t border-[var(--border-color)]">
          <Link
            href="/subscribe"
            className="flex items-center justify-center gap-2 w-full py-3.5 sm:py-4 px-4 rounded-xl bg-[var(--uscis-blue)] font-semibold text-sm sm:text-base shadow-[var(--shadow-sm)] hover:bg-[var(--uscis-blue-dark)] active:scale-[0.98] transition-all duration-200"
            style={{ color: "#fff" }}
          >
            <SparklesIcon className="w-5 h-5" style={{ color: "#fff" }} />
            <span style={{ color: "#fff" }}>{hasUsedTrial ? "Subscribe Now" : "Start 3-day free trial"}</span>
          </Link>
          <p className="text-center text-xs text-[var(--text-secondary)] mt-2">
            {hasUsedTrial ? "$4.99/month · Cancel anytime" : "$0 today, then $4.99/month · Cancel anytime"}
          </p>
        </div>
      </div>
    </div>
  );
}
