import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Axiom design system — Vision XIX Labs",
  description:
    "The restrained visual and interaction rules behind the Axiom website and desktop experience.",
};

const colors = [
  ["Canvas", "#141414"],
  ["Surface", "#1A1A1A"],
  ["Text", "#EFEFEC"],
  ["Axiom orange", "#F54E00"],
] as const;

const principles = [
  ["Show the work", "Product behavior is the proof. Decoration never substitutes for capability."],
  ["Reveal complexity progressively", "Start with the next safe action; expose advanced configuration when it becomes relevant."],
  ["State boundaries plainly", "Released, configured, preview, and simulated states must look and read differently."],
  ["Preserve control", "Writes, deployment, and production authority stay visible, scoped, and approval-gated."],
] as const;

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-[#141414] text-[#efefec]">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1200px] px-5 pb-20 pt-28 sm:px-8 lg:pb-28 lg:pt-36">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#ff783d]">Design system</p>
          <h1 className="mt-6 max-w-5xl text-5xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-7xl">
            Complexity belongs in the capability.
            <span className="block text-zinc-500">Not in the interface.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-zinc-400">
            Axiom uses a quiet neutral system, one intentional accent, direct
            language, and motion only when it explains a state change.
          </p>
        </section>

        <section className="border-y border-white/[0.08] bg-[#181818]">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
              <div>
                <p className="font-mono text-xs text-zinc-600">01</p>
                <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">Color</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  Near-black structure, near-white type, and orange for the one
                  thing that needs attention.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
                {colors.map(([name, hex]) => (
                  <div key={name} className="bg-[#141414] p-5">
                    <div className="h-24 rounded-xl border border-white/[0.1]" style={{ backgroundColor: hex }} />
                    <div className="mt-4 flex items-center justify-between gap-4 text-sm">
                      <span>{name}</span>
                      <code className="text-xs text-zinc-600">{hex}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="font-mono text-xs text-zinc-600">02</p>
              <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">Type and rhythm</h2>
            </div>
            <div className="space-y-10 border-y border-white/[0.08] py-8">
              <p className="text-5xl font-medium leading-none tracking-[-0.055em] sm:text-6xl">
                Clear at a glance.
              </p>
              <p className="max-w-2xl text-base leading-7 text-zinc-400">
                Headlines make one point. Body copy explains the decision or
                next action. Technical detail stays available without occupying
                the first reading path.
              </p>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-600">
                Status · repository scoped · approval required
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#181818]">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-24">
            <p className="font-mono text-xs text-zinc-600">03</p>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">Interaction rules</h2>
            <div className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {principles.map(([title, detail]) => (
                <div key={title} className="grid gap-3 py-6 md:grid-cols-[260px_1fr]">
                  <h3 className="font-medium">{title}</h3>
                  <p className="max-w-2xl text-sm leading-6 text-zinc-500">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-28">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#ff783d]">See it applied</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
              Watch the workflow explain itself.
            </h2>
          </div>
          <Link href="/demo" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#efefec] px-6 text-sm font-semibold text-[#141414] hover:bg-white">
            Explore the interactive demo
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
