import type { ReactNode } from "react";

type AxiomMetricCardProps = {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AxiomMetricCard({ label, value, footer, className = "" }: AxiomMetricCardProps) {
  return (
    <div
      className={`rounded-2xl bg-white/80 dark:bg-slate-900/80 shadow-sm backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/50 px-4 py-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-violet-200/80 dark:hover:border-violet-700/50 ${className}`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="mt-2 text-slate-900 dark:text-slate-100">{value}</div>
      {footer && <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{footer}</div>}
    </div>
  );
}

