"use client";

import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

export function CloudTrustGrid({ principles }: { principles: string[] }) {
  return (
    <div className="space-y-3">
      {principles.map((principle, idx) => (
        <Reveal key={principle} direction="up" delay={idx * 0.06}>
          <HoverCard className="p-4 bg-white/[0.02] border-white/[0.06] shadow-lg text-sm text-zinc-300">
            {principle}
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
