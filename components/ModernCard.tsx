"use client";

import React from "react";

interface ModernCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "subtle" | "gradient" | "government";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

/**
 * ModernCard - Sleek, clean card component with advanced styling
 * Provides consistent, professional card design across the site
 */
export default function ModernCard({
  children,
  className = "",
  variant = "default",
  hover = true,
  padding = "md",
}: ModernCardProps) {
  const baseClasses = "rounded-sm border transition-colors duration-200";
  
  const variantClasses = {
    default: "bg-[var(--bg-surface)] border-[var(--border-color)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
    elevated: "bg-[var(--bg-surface)] border-[var(--border-color)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
    subtle: "bg-[var(--bg-surface-alt)] border-[var(--border-color)] shadow-xs",
    gradient: "bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-alt)] border-[var(--border-color)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
    government: "bg-[var(--bg-surface)] border-[var(--border-color)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-sm",
  };
  
  const hoverClasses = hover
    ? "hover:border-[var(--border-color-hover)]"
    : "";
  
  const paddingClasses = {
    none: "",
    sm: "p-3 sm:p-4",
    md: "p-4 sm:p-5 md:p-6",
    lg: "p-6 sm:p-7 md:p-8",
  };
  
  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
