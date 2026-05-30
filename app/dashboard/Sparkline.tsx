"use client";

/**
 * Tiny inline sparkline rendered as SVG bars. No external library —
 * pure SVG path with seven daily buckets. Auto-scales to the local
 * max so a tile with one entry still shows the shape.
 */

interface Props {
  values: ReadonlyArray<number>;
  /** Tailwind text color class to drive both the bar fill (via fill="currentColor")
   *  and the optional label. */
  tone?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, tone = "text-zinc-500", width = 56, height = 16 }: Props) {
  if (!values || values.length === 0) return null;
  const max = Math.max(1, ...values);
  const barW = width / values.length;
  const gap = 1;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={tone}
      aria-hidden
    >
      {values.map((v, i) => {
        const h = (v / max) * (height - 1);
        return (
          <rect
            key={i}
            x={i * barW + gap / 2}
            y={height - h}
            width={Math.max(1, barW - gap)}
            height={Math.max(1, h)}
            fill="currentColor"
            opacity={v === 0 ? 0.25 : 0.85}
          />
        );
      })}
    </svg>
  );
}
