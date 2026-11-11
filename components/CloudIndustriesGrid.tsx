"use client";

import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

export function CloudIndustriesGrid({ industries }: { industries: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {industries.map((industry, idx) => (
        <Reveal key={industry} direction="up" delay={idx * 0.06}>
          <HoverCard className="p-4 bg-white/2 border-white/6 shadow-lg text-sm text-zinc-300 text-center">
            {industry}
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
