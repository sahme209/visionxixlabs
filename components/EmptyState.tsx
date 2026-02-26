"use client";

import Image from "next/image";
import Link from "next/link";
import { EMPTY_STATE_IMAGES } from "@/lib/images";
import GradientIconBadge, { BadgeColor } from "@/components/GradientIconBadge";
import { DocumentTextIcon, ChartBarIcon, ClockIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

interface EmptyStateProps {
  icon?: "document" | "chart" | "clock" | "info" | "warning";
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  /** Optional background image variant for section accent */
  imageVariant?: "documents" | "search" | "news" | "guides" | "profile";
}

const EMPTY_ICON_MAP: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: BadgeColor }> = {
  document: { Icon: DocumentTextIcon, color: "blue" },
  chart: { Icon: ChartBarIcon, color: "emerald" },
  clock: { Icon: ClockIcon, color: "sky" },
  info: { Icon: ClipboardDocumentListIcon, color: "violet" },
  warning: { Icon: ExclamationTriangleIcon, color: "red" },
};

export default function EmptyState({
  icon = "info",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
  imageVariant,
}: EmptyStateProps) {
  const imageSrc = imageVariant ? EMPTY_STATE_IMAGES[imageVariant] : null;
  const { Icon, color } = EMPTY_ICON_MAP[icon];

  const actionButton = actionLabel && (actionHref || onAction) ? (
    actionHref ? (
      <Link
        href={actionHref}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--uscis-blue)] text-white rounded-lg hover:bg-[var(--uscis-blue-dark)] transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg hover:scale-105"
      >
        {actionLabel}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    ) : (
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--uscis-blue)] text-white rounded-lg hover:bg-[var(--uscis-blue-dark)] transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg hover:scale-105"
      >
        {actionLabel}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    )
  ) : null;

  return (
    <div className={`empty-state-enhanced relative overflow-hidden ${className}`}>
      {imageSrc && (
        <div className="absolute inset-0 opacity-[0.05]">
          <Image src={imageSrc} alt="" fill className="object-cover" sizes="600px" />
        </div>
      )}
      <div className={`empty-state-enhanced-icon ${imageSrc ? "relative" : ""} mx-auto`}>
        <GradientIconBadge icon={Icon} color={color} size="lg" />
      </div>
      <h3 className={`empty-state-enhanced-title ${imageSrc ? "relative" : ""}`}>{title}</h3>
      <p className={`empty-state-enhanced-description ${imageSrc ? "relative" : ""}`}>{description}</p>
      {actionButton && <div className="mt-6">{actionButton}</div>}
    </div>
  );
}
