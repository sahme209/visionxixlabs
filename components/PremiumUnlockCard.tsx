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
import GradientIconBadge, { BadgeColor } from "@/components/GradientIconBadge";

const FEATURES: { icon: React.ComponentType<{ className?: string }>; label: string; short: string; color: BadgeColor }[] = [
  { icon: ChartBarIcon, label: "Your queue position", short: "Queue position", color: "blue" },
  { icon: ClockIcon, label: "Current processing times", short: "Processing times", color: "sky" },
  { icon: ArrowTrendingUpIcon, label: "Daily approval activity", short: "Approval activity", color: "emerald" },
  { icon: BriefcaseIcon, label: "Case tools", short: "Case tools", color: "indigo" },
  { icon: BoltIcon, label: "Expedite request", short: "Expedite", color: "amber" },
  { icon: MapIcon, label: "Action plan", short: "Action plan", color: "teal" },
];

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
          <GradientIconBadge icon={SparklesIcon} color="violet" size="md" />
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
          {FEATURES.map(({ icon: Icon, label, short, color }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50"
            >
              <GradientIconBadge icon={Icon} color={color} size="sm" />
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
