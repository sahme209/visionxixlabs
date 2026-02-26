"use client";

import { useState } from "react";
import { InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface ContextualHelpProps {
  title: string;
  content: string;
  variant?: "info" | "tip" | "warning" | "success";
  dismissible?: boolean;
  className?: string;
}

export default function ContextualHelp({
  title,
  content,
  variant = "info",
  dismissible = true,
  className = "",
}: ContextualHelpProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const variantStyles = {
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-800",
      icon: InformationCircleIcon,
      iconColor: "text-gray-800 dark:text-gray-200",
    },
    tip: {
      bg: "bg-green-50 dark:bg-green-950/30",
      border: "border-green-200 dark:border-green-800",
      icon: CheckCircleIcon,
      iconColor: "text-green-600 dark:text-green-400",
    },
    warning: {
      bg: "bg-orange-50 dark:bg-orange-950/30",
      border: "border-orange-200 dark:border-orange-800",
      icon: InformationCircleIcon,
      iconColor: "text-orange-600 dark:text-orange-400",
    },
    success: {
      bg: "bg-green-50 dark:bg-green-950/30",
      border: "border-green-200 dark:border-green-800",
      icon: CheckCircleIcon,
      iconColor: "text-green-600 dark:text-green-400",
    },
  };

  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <div
      className={`rounded-lg border-l-4 ${style.bg} ${style.border} p-4 animate-slide-up-fade ${className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${style.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h4>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{content}</p>
        </div>
        {dismissible && (
          <button
            onClick={() => setIsDismissed(true)}
            className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
