"use client";

type AccentMarkerProps = {
  color?: "violet" | "fuchsia" | "indigo" | "emerald" | "orange" | "red";
  size?: "sm" | "md";
  className?: string;
};

const colorClasses = {
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

export function AccentMarker({
  color = "violet",
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
