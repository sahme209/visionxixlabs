"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";

export default function RealisticFogDemoPage() {
  return (
    <div className="relative min-h-screen">
      <RealisticFogBackground />
      <div className="relative z-10">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Home
          </Link>
          <header className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-2">
              Realistic Fog Background
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto">
              WebGL fragment shader–driven generative mist. Move your cursor to add a subtle glow.
            </p>
          </header>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 text-center">
            <p className="text-slate-300">
              The mist animates over time using FBM noise. Cursor proximity adds a soft blue highlight.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
