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
        {/* Diagonal spotlight — strong, visible */}
        <div
          className="absolute inset-0 opacity-100"
          style={{
            background:
              "linear-gradient(135deg, rgb(124 58 237 / 0.08) 0%, transparent 35%, rgb(217 70 239 / 0.1) 55%, transparent 80%)",
          }}
        />
        <div
          className="absolute -top-20 -right-10 w-[min(70vw,600px)] h-[min(85vh,700px)] opacity-90 dark:opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 85% 15%, rgb(124 58 237 / 0.25), rgb(217 70 239 / 0.12), transparent 60%)",
          }}
        />
        <div
          className="absolute -bottom-32 -left-20 w-[min(60vw,500px)] h-[min(60vh,500px)] opacity-80 dark:opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 55% 55% at 15% 85%, rgb(217 70 239 / 0.2), rgb(124 58 237 / 0.08), transparent 60%)",
          }}
        />
        {/* Center glow behind content */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,800px)] h-[min(70vh,500px)] opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 80% at 50% 50%, rgb(124 58 237 / 0.12), transparent 70%)",
          }}
        />
        {/* Vignette — stronger */}
        <div
          className={vignette}
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, rgb(0 0 0 / 0.08) 80%, rgb(0 0 0 / 0.12) 100%)",
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
