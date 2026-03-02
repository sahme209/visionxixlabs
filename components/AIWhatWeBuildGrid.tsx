"use client";

import type { AISolutionCard as AISolutionCardType } from "@/lib/aiContent";
import { AISolutionCard } from "@/components/AISolutionCard";
import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

export function AIWhatWeBuildGrid({
  cards,
}: {
  cards: AISolutionCardType[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {cards.map((card, idx) => (
        <Reveal key={card.id} direction="up" delay={idx * 0.06}>
          <HoverCard minimal>
            <AISolutionCard {...card} />
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
