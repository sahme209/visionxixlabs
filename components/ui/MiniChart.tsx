"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotionQuery } from "@/lib/motion/tokens";

type ChartType = "line" | "bars" | "area";

type MiniChartProps = {
  type?: ChartType;
  color?: "violet" | "fuchsia" | "emerald";
  className?: string;
};

const colorMap = {
  violet: { stroke: "#8b5cf6", fill: "rgba(139,92,246,0.15)" },
  fuchsia: { stroke: "#d946ef", fill: "rgba(217,70,239,0.15)" },
  emerald: { stroke: "#10b981", fill: "rgba(16,185,129,0.15)" },
};

export function MiniChart({
  type = "line",
  color = "violet",
  className = "",
}: MiniChartProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const { stroke, fill } = colorMap[color];
  const w = 80;
  const h = 36;

  if (type === "line") {
    const points = [12, 24, 18, 30, 22, 26, 28, 20, 32, 14];
    const step = w / (points.length - 1);
    const max = Math.max(...points);
    const pathD = points
      .map((v, i) => {
        const x = i * step;
        const y = h - (v / max) * (h - 4) - 2;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={`min-w-[80px] h-9 ${className}`}
        aria-hidden
      >
        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "area") {
    const points = [8, 20, 14, 26, 18, 22, 24, 16, 28, 10];
    const step = w / (points.length - 1);
    const max = Math.max(...points);
    const pathD =
      points
        .map((v, i) => {
          const x = i * step;
          const y = h - (v / max) * (h - 6) - 3;
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ") + ` L ${w} ${h} L 0 ${h} Z`;
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={`min-w-[80px] h-9 ${className}`}
        aria-hidden
      >
        <path d={pathD} fill={fill} stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  const bars = [6, 10, 8, 12, 7, 11, 9, 14, 8, 10];
  const barW = (w - (bars.length - 1) * 2) / bars.length;
  const maxBar = Math.max(...bars);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`min-w-[80px] h-9 ${className}`}
      aria-hidden
    >
      {bars.map((v, i) => {
        const x = i * (barW + 2);
        const barH = (v / maxBar) * (h - 6);
        const y = h - barH - 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={1}
            fill={fill}
            stroke={stroke}
            strokeWidth="0.5"
          />
        );
      })}
    </svg>
  );
}
