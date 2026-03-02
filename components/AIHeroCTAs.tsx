"use client";

import { AnimatedButton } from "@/components/ui/AnimatedButton";

type Props = {
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export function AIHeroCTAs({
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      <AnimatedButton href={primaryHref} variant="primary" className="shadow-lg">
        {primaryLabel}
      </AnimatedButton>
      <AnimatedButton
        href={secondaryHref}
        variant="secondary"
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
      >
        {secondaryLabel}
      </AnimatedButton>
    </div>
  );
}
