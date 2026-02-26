"use client";

import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

interface StatusIndicatorProps {
  status: "success" | "pending" | "warning" | "error" | "info";
  label: string;
  size?: "sm" | "md" | "lg";
  showPulse?: boolean;
  className?: string;
}

export default function StatusIndicator({
  status,
  label,
  size = "md",
  showPulse = false,
  className = "",
}: StatusIndicatorProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const statusConfig = {
    success: {
      icon: CheckCircleIcon,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
      border: "border-green-300 dark:border-green-700",
    },
    pending: {
      icon: ClockIcon,
      color: "text-[var(--text-primary)] dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      border: "border-blue-300 dark:border-blue-700",
    },
    warning: {
      icon: ExclamationCircleIcon,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30",
      border: "border-orange-300 dark:border-orange-700",
    },
    error: {
      icon: XCircleIcon,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
      border: "border-red-300 dark:border-red-700",
    },
    info: {
      icon: ClockIcon,
      color: "text-gray-800 dark:text-gray-200",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      border: "border-blue-300 dark:border-blue-700",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className={`relative ${sizeClasses[size]}`}>
        <Icon
          className={`${sizeClasses[size]} ${config.color} ${showPulse ? "animate-pulse" : ""}`}
        />
        {showPulse && (
          <div
            className={`absolute inset-0 ${sizeClasses[size]} ${config.color} opacity-50 animate-ping`}
          />
        )}
      </div>
      <span className={`text-sm font-medium ${config.color}`}>{label}</span>
    </div>
  );
}
