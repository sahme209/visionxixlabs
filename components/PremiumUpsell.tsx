"use client";

import React from "react";
import Link from "next/link";
import { LockClosedIcon, SparklesIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useSubscription } from "@/hooks/useSubscription";

interface PremiumUpsellProps {
  title?: string;
  features: string[];
  ctaText?: string;
  variant?: "default" | "centered" | "minimal";
  subtitle?: string;
}

export function PremiumUpsell({ 
  title = "Unlock Your Complete Journey",
  features,
  ctaText = "Subscribe to Unlock",
  variant = "default",
  subtitle
}: PremiumUpsellProps) {
  const { hasUsedTrial } = useSubscription();
  const isCentered = variant === "centered";
  const isMinimal = variant === "minimal";

  if (isMinimal) {
    return (
      <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[var(--uscis-blue)]/10 to-[var(--uscis-blue-dark)]/10 border border-[var(--uscis-blue)]/20">
        <LockClosedIcon className="w-4 h-4 text-[var(--text-primary)]" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {!hasUsedTrial && (
            <span className="text-[9px] font-semibold text-[var(--text-primary)] bg-[var(--uscis-blue)]/10 px-1.5 py-0.5 rounded">
              3-Day Trial
            </span>
          )}
        </div>
        <Link
          href="/subscribe"
          className="ml-2 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {ctaText} →
        </Link>
      </div>
    );
  }

  return (
    <div className={`${isCentered ? 'flex items-center justify-center w-full' : ''}`}>
      <div className={`${isCentered ? 'text-center max-w-lg w-full' : ''} space-y-6`}>
        {/* Icon with 3 circles behind it and subtle glow - with larger container to prevent overlap */}
        <div className={`${isCentered ? 'mx-auto' : ''} relative flex h-24 w-24 items-center justify-center mb-4`}>
          {/* 3 Circles behind the icon */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-[var(--uscis-blue)]/20 to-[var(--uscis-blue-dark)]/15 blur-2xl animate-pulse"></div>
            <div className="absolute w-36 h-36 rounded-full bg-gradient-to-br from-[var(--uscis-blue)]/15 to-[var(--uscis-blue-dark)]/10 blur-2xl -z-10"></div>
            <div className="absolute w-44 h-44 rounded-full bg-gradient-to-br from-[var(--uscis-blue)]/10 to-[var(--uscis-blue-dark)]/5 blur-3xl -z-20"></div>
          </div>
          {/* Icon */}
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--uscis-blue)]/25 via-[var(--uscis-blue)]/30 to-[var(--uscis-blue-dark)]/35 border-2 border-[var(--uscis-blue)]/40 shadow-xl shadow-[var(--uscis-blue)]/30">
            <SparklesIcon className="w-12 h-12 text-[var(--text-primary)]" />
          </div>
        </div>

        {/* Title with stronger impact */}
        <div className="space-y-2.5">
          <div className="flex flex-col gap-2">
            <h3 className={`${isCentered ? 'text-xl' : 'text-lg'} font-bold tracking-tight text-[var(--text-primary)] leading-tight`}>
              {title}
            </h3>
            {!hasUsedTrial && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold text-[var(--text-primary)] bg-[var(--uscis-blue)]/10 w-fit ${isCentered ? 'mx-auto' : ''}`}>
                3-Day Free Trial
              </span>
            )}
          </div>
          {subtitle && (
            <p className={`${isCentered ? 'text-sm' : 'text-xs'} text-[var(--text-secondary)] leading-relaxed`}>
              {subtitle}
            </p>
          )}
          
          {/* Features with checkmarks for psychological validation */}
          {features.length > 0 && (
            <div className={`flex ${isCentered ? 'justify-center' : ''} flex-wrap gap-x-2.5 gap-y-1.5 mt-3`}>
              {features.map((feature, idx) => (
                <React.Fragment key={idx}>
                  <div className="inline-flex items-center gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {feature}
                    </span>
                  </div>
                  {idx < features.length - 1 && (
                    <span className="text-xs text-[var(--text-tertiary)] self-center">•</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Enhanced CTA Button - full width for better mobile tap target */}
        <Link
          href="/subscribe"
          className={`w-full group relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] text-white text-sm font-bold rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-[var(--uscis-blue)]/40 hover:scale-[1.01] active:scale-[0.99] overflow-hidden`}
        >
          <div className="relative z-10 flex items-center gap-2.5">
            <span>{ctaText}</span>
            <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
          {!hasUsedTrial && (
            <span className="relative z-10 text-[10px] font-semibold text-white/90 bg-white/25 px-2 py-0.5 rounded">
              3-Day Free Trial
            </span>
          )}
          {/* Subtle shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </Link>
      </div>
    </div>
  );
}
