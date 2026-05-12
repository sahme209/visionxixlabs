"use client";

import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

type UseCaseExpanded = { category: string; items: string[] };

export function AIUseCasesExpandedGrid({
  useCases,
}: {
  useCases: UseCaseExpanded[];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {useCases.map((uc, idx) => (
        <Reveal key={uc.category} direction="up" delay={idx * 0.06}>
          <HoverCard className="p-6 bg-white/[0.02] border-white/[0.06]">
            <h3 className="font-semibold text-white mb-3">
              {uc.category}
            </h3>
            <ul className="space-y-1 text-sm text-zinc-400">
              {uc.items.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
