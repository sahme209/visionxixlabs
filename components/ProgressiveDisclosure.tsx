"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface ProgressiveDisclosureProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  variant?: "default" | "compact";
  className?: string;
}

export default function ProgressiveDisclosure({
  title,
  defaultOpen = false,
  children,
  variant = "default",
  className = "",
}: ProgressiveDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`uscis-card overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-surface-alt)] transition-colors"
      >
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-[var(--text-secondary)]" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-[var(--text-secondary)]" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className={`${variant === "compact" ? "p-4 pt-0" : "p-6 pt-0"}`}>{children}</div>
      </div>
    </div>
  );
}
