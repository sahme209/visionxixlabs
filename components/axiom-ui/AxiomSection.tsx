import type { ReactNode } from "react";

type AxiomSectionProps = {
  children: ReactNode;
  className?: string;
};

export function AxiomSection({ children, className = "" }: AxiomSectionProps) {
  return (
    <section className={`rounded-2xl bg-white/80 dark:bg-slate-900/80 shadow-sm p-6 md:p-8 ${className}`}>
      {children}
    </section>
  );
}

