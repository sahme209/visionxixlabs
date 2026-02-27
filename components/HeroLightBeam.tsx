"use client";

/**
 * Huly-inspired vertical light beam / pillar in hero — creates dramatic depth
 */
export function HeroLightBeam() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
      aria-hidden
    >
      {/* Vertical beam — right side */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[min(50vw,400px)] light-beam opacity-80"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgb(124 58 237 / 0.04) 25%, rgb(217 70 239 / 0.1) 50%, rgb(124 58 237 / 0.06) 75%, transparent 100%)" }}
      />
      {/* Diagonal streak */}
      <div
        className="absolute inset-0 diagonal-streak opacity-50"
        style={{ background: "linear-gradient(135deg, transparent 0%, rgb(124 58 237 / 0.05) 40%, rgb(217 70 239 / 0.07) 60%, transparent 80%)" }}
      />
    </div>
  );
}
