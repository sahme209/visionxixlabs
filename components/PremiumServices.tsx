"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSubscription } from "@/hooks/useSubscription";
import { StarIcon, LockClosedIcon, BoltIcon, SparklesIcon, BriefcaseIcon } from "@heroicons/react/24/solid";
import { HERO_IMAGES, TOOL_PILL_IMAGES } from "@/lib/images";
import GradientIconBadge, { BadgeColor } from "@/components/GradientIconBadge";

/**
 * Premium Services Section
 * Exact match of iOS OverviewSectionView.premiumServicesSection
 * Shows: Case Tools, Expedite, Action Plan as horizontal pills
 */

interface PremiumPillProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  color: string;
  colorLight: string;
  badgeColor: BadgeColor;
  href: string;
  onClick?: () => void;
  isLocked?: boolean;
  imageSrc?: string;
}

// Premium pill component (matches iOS compactPremiumPillContent)
function PremiumPill({ icon, title, subtitle, color, colorLight, badgeColor, href, onClick, isLocked, imageSrc }: PremiumPillProps) {
  const content = (
    <div
      className="relative flex flex-col items-center gap-2 sm:gap-2.5 rounded-xl p-3 sm:p-5 min-h-[88px] sm:min-h-0 transition-all duration-300 hover:scale-[1.02] sm:hover:scale-[1.03] active:scale-[0.98] hover:shadow-lg touch-manipulation overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${colorLight}18, ${color}12)`,
        border: `1px solid ${color}25`,
        boxShadow: `0 2px 8px ${color}15`,
      }}
    >
      {imageSrc && (
        <div className="absolute inset-0 opacity-[0.08]">
          <Image src={imageSrc} alt="" fill className="object-cover" sizes="200px" />
        </div>
      )}
      {/* Icon with gradient background - Expedite style */}
      <div className="relative">
        <GradientIconBadge icon={icon} color={badgeColor} size="xs" />
      </div>

      {/* Text */}
      <div className="relative flex flex-col items-center gap-0.5 text-center">
        <span className="text-xs sm:text-sm font-semibold leading-tight text-[var(--text-primary)]">{title}</span>
        <span className="text-[10px] sm:text-xs leading-tight text-[var(--text-secondary)]">{subtitle}</span>
      </div>

      {/* Lock overlay if locked */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/10 backdrop-blur-sm">
          <LockClosedIcon className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="flex-1" type="button">
        {content}
      </button>
    );
  }

  // When locked, navigate to subscribe page instead of tool
  const linkHref = isLocked ? "/subscribe" : href;
  return (
    <Link href={linkHref} className="flex-1 block">
      {content}
    </Link>
  );
}

export default function PremiumServices() {
  const { isSubscribed } = useSubscription();
  
  // Case Tools is locked behind subscription, same as Expedite and Action Plan
  const hasUnlockedCaseTools = isSubscribed;

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.05]">
        <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="800px" />
      </div>
      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <GradientIconBadge icon={StarIcon} color="blue" size="sm" />
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Premium Services</h3>
            <p className="text-xs text-[var(--text-secondary)]">Case tools, expedite & smart guidance</p>
          </div>
        </div>

        {/* Pills - Equal width, horizontal layout, touch-friendly on mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Case Tools - Gated behind subscription */}
        <PremiumPill
          icon={BriefcaseIcon}
          title="Case Tools"
          subtitle="Premium suite"
          color="#1E3A8A"
          colorLight="#3B82F6"
          badgeColor="blue"
          href="/tools/case-tools"
          isLocked={!isSubscribed}
          imageSrc={TOOL_PILL_IMAGES.caseTools}
        />

        <PremiumPill
          icon={BoltIcon}
          title="Expedite"
          subtitle="Priority service"
          color="#D97706"
          colorLight="#FBBF24"
          badgeColor="amber"
          href="/tools/expedite"
          isLocked={!isSubscribed}
          imageSrc={TOOL_PILL_IMAGES.expedite}
        />

        <PremiumPill
          icon={SparklesIcon}
          title="Action Plan"
          subtitle="Smart guidance"
          color="#059669"
          colorLight="#10B981"
          badgeColor="emerald"
          href="/tools/action-plan"
          isLocked={!isSubscribed}
          imageSrc={TOOL_PILL_IMAGES.actionPlan}
        />
        </div>
      </div>
    </div>
  );
}
