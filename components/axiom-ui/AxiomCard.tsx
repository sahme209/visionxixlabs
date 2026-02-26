import type { ReactNode } from "react";

type AxiomCardProps = {
  children: ReactNode;
  className?: string;
};

export function AxiomCard({ children, className = "" }: AxiomCardProps) {
  return (
    <div
      className={`axiom-card rounded-2xl bg-white/80 dark:bg-slate-900/80 shadow-sm backdrop-blur-sm transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-md ${className}`}
    >
      {children}
    </div>
  );
}

