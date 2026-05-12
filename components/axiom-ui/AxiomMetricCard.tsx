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
      className={`rounded-2xl bg-white/[0.02] shadow-sm backdrop-blur-sm border border-white/[0.06] px-4 py-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-violet-500/30 ${className}`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="mt-2 text-white">{value}</div>
      {footer && <div className="mt-1 text-[11px] text-zinc-500">{footer}</div>}
    </div>
  );
}

