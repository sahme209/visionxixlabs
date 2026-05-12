"use client";

/**
 * Hero headline with per-word hover glow — futuristic multi-color animation
 */
const HEADLINE_WORDS = [
  { text: "Axiom:", color: "#818cf8" },     // indigo
  { text: " ", color: "transparent" },
  { text: "Your", color: "#64748b" },
  { text: " ", color: "transparent" },
  { text: "Autonomous", color: "#a78bfa" }, // violet
  { text: " ", color: "transparent" },
  { text: "Cloud", color: "#22d3ee" },      // cyan
  { text: " ", color: "transparent" },
  { text: "Operations", color: "#34d399" }, // emerald
  { text: " ", color: "transparent" },
  { text: "Agent", color: "#f97316" },      // orange
] as const;

export function HeroHeadlineGlow() {
  return (
    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight animate-hero-enter flex flex-wrap justify-center gap-x-[0.25em] gap-y-1 text-white">
      {HEADLINE_WORDS.map(({ text, color }, i) => (
        <span
          key={i}
          className="hero-word-glow inline-block cursor-default"
          data-glow-color={color !== "transparent" ? color : undefined}
          style={
            color !== "transparent"
              ? ({ "--glow-color": color } as React.CSSProperties)
              : undefined
          }
        >
          {text}
        </span>
      ))}
    </h1>
  );
}
