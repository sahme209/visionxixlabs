"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { GlowingEffectDemo } from "@/components/ui/GlowingEffectDemo";
import { Reveal } from "@/components/motion/Reveal";

export default function GlowingEffectDemoPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-25 pointer-events-none" />
      <div className="bg-grid-mesh absolute inset-0 pointer-events-none" />

      <Navigation />
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <Reveal direction="up" blur delay={0.05}>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 mb-8 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Home
          </Link>
        </Reveal>
        <Reveal direction="up" blur delay={0.1}>
          <header className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
              Glowing Effect <span className="text-gradient">Demo</span>
            </h1>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Interactive cards with mouse-following gradient glow. Move your cursor over the cards.
            </p>
          </header>
        </Reveal>
        <Reveal direction="up" blur delay={0.15}>
          <GlowingEffectDemo />
        </Reveal>
      </main>
    </div>
  );
}
