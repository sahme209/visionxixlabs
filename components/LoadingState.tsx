"use client";

import { useEffect, useState } from "react";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "skeleton" | "pulse";
  className?: string;
}

export default function LoadingState({ 
  message = "Loading...", 
  size = "md",
  variant = "spinner",
  className = "" 
}: LoadingStateProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (variant === "spinner") {
      const interval = setInterval(() => {
        setDots((prev) => {
          if (prev === "...") return "";
          return prev + ".";
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [variant]);

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  if (variant === "skeleton") {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        <div className="h-4 bg-[var(--bg-surface-alt)] rounded w-3/4"></div>
        <div className="h-4 bg-[var(--bg-surface-alt)] rounded"></div>
        <div className="h-4 bg-[var(--bg-surface-alt)] rounded w-5/6"></div>
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] animate-pulse`}></div>
        {message && (
          <p className="text-sm text-[var(--text-secondary)] font-medium">{message}{dots}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`${sizeClasses[size]} border-4 border-[var(--uscis-blue)]/20 border-t-[var(--uscis-blue)] rounded-full animate-spin`}></div>
      {message && (
        <p className="text-sm text-[var(--text-secondary)] font-medium">{message}{dots}</p>
      )}
    </div>
  );
}
