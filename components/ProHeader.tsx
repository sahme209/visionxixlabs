"use client";

import Image from "next/image";

/**
 * Shared page header: gradient strip + grid overlay + content slot.
 * Use for stats, help, subscribe, settings, terms, privacy, guides, news, etc.
 */
export default function ProHeader({
  children,
  className = "",
  backgroundImage,
}: {
  children: React.ReactNode;
  className?: string;
  backgroundImage?: string;
}) {
  return (
    <div className="surface-dark relative bg-[var(--hero-dark)] border-b border-white/5 overflow-hidden">
      {backgroundImage && (
        <div className="absolute inset-0 w-full">
          <Image
            src={backgroundImage}
            alt=""
            fill
            className="object-cover object-center opacity-15 w-full"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-dark)]/95 via-[var(--hero-dark-soft)]/90 to-[var(--hero-dark)]/95" />
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0, 113, 227, 0.2) 0%, transparent 50%)" }} />
        </div>
      )}
      <div
        className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        className={`relative w-full mx-auto px-4 min-[380px]:px-5 sm:px-6 lg:px-8 py-4 ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
