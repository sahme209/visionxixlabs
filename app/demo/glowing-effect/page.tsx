"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { GlowingEffectDemo } from "@/components/ui/GlowingEffectDemo";

export default function GlowingEffectDemoPage() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 mb-8"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Home
        </Link>
        <header className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">
            Glowing Effect Demo
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Interactive cards with mouse-following gradient glow. Move your cursor over the cards.
          </p>
        </header>
        <GlowingEffectDemo />
      </main>
    </div>
  );
}
