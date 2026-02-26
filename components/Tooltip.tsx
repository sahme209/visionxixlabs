"use client";

import { useState, useRef, useEffect } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  iconOnly?: boolean;
}

export default function Tooltip({ 
  content, 
  children, 
  position = "top",
  className = "",
  iconOnly = false 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = triggerRect.top + scrollY - tooltipRect.height - 8;
          left = triggerRect.left + scrollX + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case "bottom":
          top = triggerRect.bottom + scrollY + 8;
          left = triggerRect.left + scrollX + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case "left":
          top = triggerRect.top + scrollY + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left + scrollX - tooltipRect.width - 8;
          break;
        case "right":
          top = triggerRect.top + scrollY + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + scrollX + 8;
          break;
      }

      // Keep tooltip within viewport
      const padding = 8;
      if (left < padding) left = padding;
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipRect.height > window.innerHeight + scrollY - padding) {
        top = window.innerHeight + scrollY - tooltipRect.height - padding;
      }

      setTooltipPosition({ top, left });
    }
  }, [isVisible, position]);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-flex items-center"
        role="button"
        tabIndex={0}
        aria-label="Show tooltip"
      >
        {iconOnly ? (
          <InformationCircleIcon className="w-4 h-4 text-[var(--text-primary)] cursor-help hover:text-[var(--text-secondary)] transition-colors" />
        ) : (
          children
        )}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 text-sm text-white bg-[var(--uscis-blue-dark)] rounded-lg shadow-xl max-w-xs pointer-events-none animate-fade-in border border-[var(--uscis-blue)]/30"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
          role="tooltip"
        >
          <div className="relative">
            {content}
            {/* Arrow */}
            <div
              className={`absolute w-2 h-2 bg-[var(--uscis-blue-dark)] border border-[var(--uscis-blue)]/30 ${
                position === "top" ? "bottom-[-4px] left-1/2 -translate-x-1/2 rotate-45"
                : position === "bottom" ? "top-[-4px] left-1/2 -translate-x-1/2 rotate-45"
                : position === "left" ? "right-[-4px] top-1/2 -translate-y-1/2 rotate-45"
                : "left-[-4px] top-1/2 -translate-y-1/2 rotate-45"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// InlineHelp component for form fields and labels
interface InlineHelpProps {
  term?: string;
  explanation: string;
  className?: string;
}

export function InlineHelp({ term, explanation, className = "" }: InlineHelpProps) {
  return (
    <Tooltip content={explanation} iconOnly position="top" className={className} />
  );
}
