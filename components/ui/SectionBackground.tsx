"use client";

/**
 * Premium SaaS-style section background:
 * - Diagonal spotlight gradient
 * - Subtle vignette (darker edges)
 * - Soft glow behind content
 */

type SectionBackgroundProps = {
  variant?: "hero" | "hero-light" | "dark" | "subtle";
  className?: string;
  children?: React.ReactNode;
};

export function SectionBackground({
  variant = "hero",
  className = "",
  children,
}: SectionBackgroundProps) {
  const base = "absolute inset-0 -z-10 pointer-events-none overflow-hidden";
  const vignette =
    "absolute inset-0" +
    " [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_40%,transparent_100%)]";

  if (variant === "hero-light") {
    return (
      <div className={`${base} ${className}`} aria-hidden>
        <div
          className="absolute -top-20 -right-20 w-[min(60vw,500px)] h-[min(80vh,600px)] opacity-50 dark:opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 70% 70% at 80% 20%, rgb(124 58 237 / 0.12), rgb(217 70 239 / 0.06), transparent 55%)",
          }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-[min(50vw,400px)] h-[min(50vh,400px)] opacity-40 dark:opacity-35"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 20% 80%, rgb(217 70 239 / 0.08), transparent 55%)",
          }}
        />
        <div
          className={vignette}
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgb(0 0 0 / 0.04) 100%)",
          }}
        />
        {children}
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className={`${base} ${className}`} aria-hidden>
        {/* Diagonal spotlight — top-left to bottom-right */}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(135deg, rgb(15 23 42 / 0.97) 0%, rgb(30 41 59 / 0.9) 25%, rgb(51 65 85 / 0.85) 50%, rgb(15 23 42 / 0.95) 100%)",
          }}
        />
        <div
          className="absolute -top-1/2 -right-1/4 w-full h-full opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 70% 30%, rgb(124 58 237 / 0.25), transparent 60%)",
          }}
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 w-3/4 h-3/4 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 30% 70%, rgb(217 70 239 / 0.2), transparent 60%)",
          }}
        />
        {/* Vignette */}
        <div
          className={vignette}
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgb(0 0 0 / 0.4) 100%)",
          }}
        />
        {children}
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <div className={`${base} ${className}`} aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgb(15 23 42) 0%, rgb(30 41 59) 50%, rgb(15 23 42) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 80% 80% at 50% 20%, rgb(124 58 237 / 0.15), transparent 50%)",
          }}
        />
        <div
          className={vignette}
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgb(0 0 0 / 0.3) 100%)",
          }}
        />
        {children}
      </div>
    );
  }

  return (
    <div className={`${base} ${className}`} aria-hidden>
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "linear-gradient(135deg, transparent 0%, rgb(124 58 237 / 0.03) 40%, rgb(217 70 239 / 0.05) 60%, transparent 100%)",
        }}
      />
      <div
        className={vignette}
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 60%, rgb(0 0 0 / 0.08) 100%)",
        }}
      />
      {children}
    </div>
  );
}
