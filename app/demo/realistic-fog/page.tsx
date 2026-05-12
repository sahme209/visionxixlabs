"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";

export default function RealisticFogDemoPage() {
  return (
    <div className="relative min-h-screen bg-[#09090b] overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />
      <div className="noise-grain absolute inset-0 pointer-events-none" />

      <div className="relative z-[10] min-h-screen">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
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
                Realistic <span className="text-gradient">Fog</span> Background
              </h1>
              <p className="text-zinc-400 max-w-xl mx-auto">
                WebGL fragment shader-driven generative mist. Move your cursor to add a subtle glow.
              </p>
            </header>
          </Reveal>
          <Reveal direction="up" blur delay={0.15}>
            <div className="glass-card glow-border-card beam-sweep rounded-2xl p-8 text-center">
              <p className="text-zinc-300">
                The mist animates over time using FBM noise. Cursor proximity adds a soft blue highlight.
              </p>
            </div>
          </Reveal>
        </main>
      </div>
    </div>
  );
}
