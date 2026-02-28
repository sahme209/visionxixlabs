"use client";

/**
 * Hero headline with per-word hover glow — futuristic multi-color animation
 */
const HEADLINE_WORDS = [
  { text: "Cloud", color: "#22d3ee" },      // cyan
  { text: " ", color: "transparent" },
  { text: "&", color: "#94a3b8" },
  { text: " ", color: "transparent" },
  { text: "AI", color: "#a78bfa" },         // violet
  { text: " ", color: "transparent" },
  { text: "Engineering", color: "#34d399" }, // emerald
  { text: " ", color: "transparent" },
  { text: "That", color: "#64748b" },
  { text: " ", color: "transparent" },
  { text: "Delivers", color: "#fbbf24" },   // amber
  { text: " ", color: "transparent" },
  { text: "Production", color: "#fb7185" },  // rose
  { text: " ", color: "transparent" },
  { text: "Results", color: "#818cf8" },    // indigo
  { text: " ", color: "transparent" },
  { text: "—", color: "#64748b" },
  { text: " ", color: "transparent" },
  { text: "AWS,", color: "#f97316" },       // orange
  { text: " ", color: "transparent" },
  { text: "Azure,", color: "#3b82f6" },     // blue
  { text: " ", color: "transparent" },
  { text: "GCP", color: "#ef4444" },        // red
] as const;

export function HeroHeadlineGlow() {
  return (
    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight animate-hero-enter flex flex-wrap justify-center gap-x-[0.25em] gap-y-1 text-slate-900 dark:text-slate-100">
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
