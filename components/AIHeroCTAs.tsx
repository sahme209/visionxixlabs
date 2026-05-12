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
        className="bg-white/[0.02] border border-white/[0.06]"
      >
        {secondaryLabel}
      </AnimatedButton>
    </div>
  );
}
