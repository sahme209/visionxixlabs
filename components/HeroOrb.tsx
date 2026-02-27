"use client";

/**
 * Animated gradient orb — floating, pulsing, for hero split layout
 */
export function HeroOrb() {
  return (
    <div
      className="relative w-64 h-64 md:w-80 md:h-80 flex-shrink-0 animate-float"
      aria-hidden
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400/30 to-fuchsia-500/30 blur-2xl animate-pulse-glow"
        style={{ transform: "scale(1.2)" }}
      />
      {/* Main orb */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-violet-600 opacity-90"
        style={{
          backgroundSize: "200% 200%",
          animation: "gradient-shift 6s ease infinite",
        }}
      />
      {/* Inner highlight */}
      <div
        className="absolute inset-[20%] rounded-full bg-white/20"
        style={{ transform: "translate(-10%, -10%)" }}
      />
      {/* Subtle ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-white/20"
        style={{ transform: "scale(1.02)" }}
      />
    </div>
  );
}
