"use client";

import { AnimatedButton } from "@/components/ui/AnimatedButton";

export function CloudHeroCTAs() {
  return (
    <div className="mt-8 flex flex-wrap gap-4">
      <AnimatedButton href="/contact" variant="primary" className="cta-glow shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40">
        Book a Call
      </AnimatedButton>
      <AnimatedButton
        href="#solutions-grid"
        variant="secondary"
        className="bg-white/[0.02] backdrop-blur border-2 border-white/[0.06]"
      >
        View Solutions
      </AnimatedButton>
    </div>
  );
}
