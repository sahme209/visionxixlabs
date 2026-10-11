"use client";

type AccentMarkerProps = {
  color?: "orange" | "amber" | "zinc" | "emerald" | "red";
  size?: "sm" | "md";
  className?: string;
};

const colorClasses = {
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  zinc: "bg-zinc-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
};

export function AccentMarker({
  color = "orange",
  size = "sm",
  className = "",
}: AccentMarkerProps) {
  const sizeClass = size === "sm" ? "h-2 w-2" : "h-3 w-3";
  return (
    <span
      className={`inline-block rounded-sm shrink-0 ${sizeClass} ${colorClasses[color]} ${className}`}
      aria-hidden
    />
  );
}
