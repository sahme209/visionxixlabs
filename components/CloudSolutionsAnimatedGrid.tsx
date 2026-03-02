"use client";

import type { Solution } from "@/lib/cloudContent";
import { SolutionCard } from "@/components/SolutionCard";
import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

export function CloudSolutionsAnimatedGrid({ solutions }: { solutions: Solution[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {solutions.map((solution, idx) => (
        <Reveal key={solution.id} direction="up" delay={idx * 0.06}>
          <HoverCard minimal>
            <SolutionCard {...solution} />
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
