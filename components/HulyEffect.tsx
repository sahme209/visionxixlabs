"use client";

/**
 * Huly-inspired laser beam effect — glowing light beam for hero sections.
 * Inspired by huly.io's signature hero animation.
 */
export default function HulyEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Primary laser beam - azure to violet gradient */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 w-[120%] max-w-[800px] h-[200px] sm:h-[280px] opacity-60"
        style={{
          background: `
            linear-gradient(
              180deg,
              transparent 0%,
              rgba(0, 113, 227, 0.15) 15%,
              rgba(99, 102, 241, 0.25) 35%,
              rgba(139, 92, 246, 0.2) 55%,
              rgba(0, 113, 227, 0.1) 75%,
              transparent 100%
            )
          `,
          filter: "blur(40px)",
          animation: "huly-beam-pulse 4s ease-in-out infinite",
        }}
      />
      {/* Secondary glow - softer ambient */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 w-[80%] max-w-[600px] h-[150px] sm:h-[200px] opacity-40"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 100% at 50% 0%,
              rgba(99, 102, 241, 0.2) 0%,
              rgba(139, 92, 246, 0.1) 40%,
              transparent 70%
            )
          `,
          filter: "blur(30px)",
          animation: "huly-beam-pulse 5s ease-in-out infinite 0.5s",
        }}
      />
      {/* Floating wisps - particles along the beam */}
      <div className="absolute inset-0" style={{ animation: "huly-wisps 6s ease-in-out infinite" }}>
        <div className="absolute left-[45%] top-[20%] w-2 h-2 rounded-full bg-white/40 blur-sm animate-pulse" style={{ animationDelay: "0s" }} />
        <div className="absolute left-[52%] top-[35%] w-1.5 h-1.5 rounded-full bg-indigo-300/50 blur-sm animate-pulse" style={{ animationDelay: "0.7s" }} />
        <div className="absolute left-[48%] top-[50%] w-2 h-2 rounded-full bg-violet-300/40 blur-sm animate-pulse" style={{ animationDelay: "1.4s" }} />
        <div className="absolute left-[55%] top-[65%] w-1 h-1 rounded-full bg-blue-200/60 blur-sm animate-pulse" style={{ animationDelay: "2.1s" }} />
        <div className="absolute left-[46%] top-[75%] w-1.5 h-1.5 rounded-full bg-white/30 blur-sm animate-pulse" style={{ animationDelay: "2.8s" }} />
      </div>
    </div>
  );
}
