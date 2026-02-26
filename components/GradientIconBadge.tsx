"use client";

import React from "react";

/** Gradient color presets matching the Expedite badge style (icon inside gradient square) */
export const BADGE_COLORS = {
  blue: { color: "#1E3A8A", colorLight: "#3B82F6" },
  amber: { color: "#D97706", colorLight: "#FBBF24" },
  emerald: { color: "#059669", colorLight: "#10B981" },
  violet: { color: "#6D28D9", colorLight: "#8B5CF6" },
  indigo: { color: "#4338CA", colorLight: "#6366F1" },
  rose: { color: "#BE185D", colorLight: "#EC4899" },
  sky: { color: "#0369A1", colorLight: "#0EA5E9" },
  orange: { color: "#C2410C", colorLight: "#F97316" },
  red: { color: "#B91C1C", colorLight: "#EF4444" },
  teal: { color: "#0D9488", colorLight: "#14B8A6" },
} as const;

export type BadgeColor = keyof typeof BADGE_COLORS;

interface GradientIconBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  /** Preset color name or custom { color, colorLight } */
  color?: BadgeColor | { color: string; colorLight: string };
  /** Size: xxs (24px), xs (40px), sm (32px), md (44px), lg (56px) */
  size?: "xxs" | "xs" | "sm" | "md" | "lg";
  className?: string;
}

/**
 * Badge/icon container: gradient square with white icon inside.
 * Matches the Expedite pill style (lightning bolt in amber/gold gradient).
 */
export default function GradientIconBadge({
  icon: Icon,
  color = "amber",
  size = "md",
  className = "",
}: GradientIconBadgeProps) {
  const colors =
    typeof color === "string" ? BADGE_COLORS[color] : color;
  const sizeClasses = {
    xxs: "h-6 w-6",
    xs: "h-10 w-10",
    sm: "h-8 w-8",
    md: "h-11 w-11",
    lg: "h-14 w-14",
  };
  const iconSizeClasses = {
    xxs: "w-3.5 h-3.5",
    xs: "w-5 h-5",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  };

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl shadow-sm ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${colors.colorLight}, ${colors.color})`,
        boxShadow: `0 4px 12px ${colors.color}40`,
      }}
    >
      <Icon className={`${iconSizeClasses[size]} text-white`} />
    </div>
  );
}
