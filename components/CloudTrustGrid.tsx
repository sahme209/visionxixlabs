"use client";

import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

export function CloudTrustGrid({ principles }: { principles: string[] }) {
  return (
    <div className="space-y-3">
      {principles.map((principle, idx) => (
        <Reveal key={principle} direction="up" delay={idx * 0.06}>
          <HoverCard className="p-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg text-sm text-slate-700 dark:text-slate-300">
            {principle}
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
