"use client";

import { useState } from "react";
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export type AlertType = "info" | "warning" | "success" | "error";

interface USCISAlertBannerProps {
  type?: AlertType;
  title: string;
  message: string;
  linkText?: string;
  linkHref?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

/**
 * USCIS-style alert banner component
 * Matches official USCIS.gov alert design patterns
 */
export default function USCISAlertBanner({
  type = "info",
  title,
  message,
  linkText,
  linkHref,
  dismissible = true,
  onDismiss,
}: USCISAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const iconMap = {
    info: InformationCircleIcon,
    warning: ExclamationTriangleIcon,
    success: CheckCircleIcon,
    error: ExclamationTriangleIcon,
  };

  const Icon = iconMap[type];

  const colorClasses = {
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-gray-900 dark:text-gray-100",
    warning: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100",
    success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100",
    error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100",
  };

  const iconColorClasses = {
    info: "text-gray-800 dark:text-gray-200",
    warning: "text-yellow-600 dark:text-yellow-400",
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
  };

  return (
    <div
      className={`border-l-4 ${colorClasses[type]} p-4 mb-4 rounded-r-md shadow-sm`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorClasses[type]}`} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">{title}</h3>
          <p className="text-sm leading-relaxed">{message}</p>
          {linkText && linkHref && (
            <Link
              href={linkHref}
              className="inline-block mt-2 text-sm font-semibold underline underline-offset-2 hover:no-underline"
            >
              {linkText} →
            </Link>
          )}
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
            aria-label="Dismiss alert"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
