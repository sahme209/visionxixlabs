"use client";

type MetricPillProps = {
  value: string | number;
  label?: string;
  color?: "orange" | "amber" | "emerald";
  className?: string;
};

const colorClasses = {
  orange: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

export function MetricPill({ value, label, color = "orange", className = "" }: MetricPillProps) {
  return (
    <div
      className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 text-xs font-semibold ${colorClasses[color]} ${className}`}
    >
      <span>{value}</span>
      {label && <span className="text-[10px] font-medium opacity-80">{label}</span>}
    </div>
  );
}
