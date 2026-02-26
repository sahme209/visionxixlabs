"use client";

import { CheckBadgeIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";

interface OfficialBadgeProps {
  variant?: "official" | "verified" | "trusted";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function OfficialBadge({ 
  variant = "official", 
  size = "md",
  className = "" 
}: OfficialBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const variants = {
    official: {
      bg: "bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)]",
      text: "text-white",
      icon: CheckBadgeIcon,
      label: "Official Data",
    },
    verified: {
      bg: "bg-[var(--uscis-green)]",
      text: "text-white",
      icon: ShieldCheckIcon,
      label: "Verified",
    },
    trusted: {
      bg: "bg-[var(--uscis-blue)]",
      text: "text-white",
      icon: ShieldCheckIcon,
      label: "Trusted Source",
    },
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} ${config.bg} rounded-lg font-semibold shadow-md border border-white/20 ${className}`}
      style={{ color: "#fff" }}
    >
      <Icon className={`${iconSizes[size]} text-white`} style={{ color: "#fff" }} />
      <span className="text-white" style={{ color: "#fff" }}>{config.label}</span>
    </div>
  );
}
