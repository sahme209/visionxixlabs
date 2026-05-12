"use client";

type MetricPillProps = {
  value: string | number;
  label?: string;
  color?: "violet" | "fuchsia" | "emerald" | "orange";
  className?: string;
};

const colorClasses = {
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  orange: "bg-orange-500/10 text-orange-300 border-orange-500/20",
};

export function MetricPill({ value, label, color = "violet", className = "" }: MetricPillProps) {
  return (
    <div
      className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 text-xs font-semibold ${colorClasses[color]} ${className}`}
    >
      <span>{value}</span>
      {label && <span className="text-[10px] font-medium opacity-80">{label}</span>}
    </div>
  );
}
