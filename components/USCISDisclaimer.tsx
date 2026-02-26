"use client";

/**
 * Shared disclaimer for estimates and USCIS data usage.
 * Use across Home, processing-times, status-decoder, onboarding, login, etc.
 */
export default function USCISDisclaimer({ variant = "default" }: { variant?: "default" | "compact" }) {
  const text =
    "Estimates use public USCIS data—for planning only. For official status, use uscis.gov.";
  if (variant === "compact") {
    return (
      <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
        {text}
      </p>
    );
  }
  return (
    <div className="rounded-xl card-see-through border border-[var(--border-color)]/50 p-4 sm:p-6 overflow-hidden w-full min-w-0">
      <p className="text-[11px] sm:text-xs font-medium text-[var(--text-primary)] mb-1 sm:mb-1.5">How we estimate</p>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </div>
  );
}
