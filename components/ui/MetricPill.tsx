"use client";

type MetricPillProps = {
  value: string | number;
  label?: string;
  color?: "violet" | "fuchsia" | "emerald" | "orange";
  className?: string;
};

const colorClasses = {
  violet: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  fuchsia: "bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800",
  emerald: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  orange: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
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
