"use client";

import type { UseCase } from "@/lib/engineeringContent";
import { UseCaseCard } from "@/components/UseCaseCard";
import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

export function CloudUseCasesGrid({ useCases }: { useCases: UseCase[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {useCases.map((uc, idx) => (
        <Reveal key={uc.title} direction="up" delay={idx * 0.06}>
          <HoverCard minimal>
            <UseCaseCard {...uc} />
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
