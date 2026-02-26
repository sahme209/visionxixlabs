"use client";

import Image from "next/image";
import Link from "next/link";
import { EMPTY_STATE_IMAGES, ICON_IMAGES } from "@/lib/images";

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
  const iconImageMap = {
    document: ICON_IMAGES.documents,
    chart: ICON_IMAGES.chart,
    clock: ICON_IMAGES.calendar,
    info: ICON_IMAGES.checklist,
    warning: ICON_IMAGES.warning,
  } as const;
  const iconImageSrc = iconImageMap[icon];

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
      <div className={`empty-state-enhanced-icon ${imageSrc ? "relative" : ""} w-16 h-16 rounded-2xl overflow-hidden mx-auto border border-[var(--border-color)]`}>
        <Image src={iconImageSrc} alt="" width={64} height={64} className="w-full h-full object-cover" />
      </div>
      <h3 className={`empty-state-enhanced-title ${imageSrc ? "relative" : ""}`}>{title}</h3>
      <p className={`empty-state-enhanced-description ${imageSrc ? "relative" : ""}`}>{description}</p>
      {actionButton && <div className="mt-6">{actionButton}</div>}
    </div>
  );
}
