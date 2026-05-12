"use client";

import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

type Differentiator = { title: string; description: string };

export function AIDifferentiatorsGrid({
  differentiators,
}: {
  differentiators: Differentiator[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {differentiators.map((d, idx) => (
        <Reveal key={d.title} direction="up" delay={idx * 0.06}>
          <HoverCard className="p-6 bg-white/[0.02] border-white/[0.06]">
            <h3 className="font-semibold text-white mb-2">
              {d.title}
            </h3>
            <p className="text-sm text-zinc-400">
              {d.description}
            </p>
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
