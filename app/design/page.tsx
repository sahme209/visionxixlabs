import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { PageHero } from "@/components/marketing/PageHero";

export const metadata: Metadata = {
  title: "V19 design system — Vision XIX Labs",
  description:
    "The restrained visual and interaction rules behind the V19 website and desktop experience.",
};

const colors = [
  ["Canvas", "#0A0908"],
  ["Surface", "#171615"],
  ["Text", "#FFFFFF"],
  ["Secondary text", "#BFBDB6"],
  ["Muted text", "#858585"],
] as const;

const principles = [
  ["Show the work", "Product behavior is the proof. Decoration never substitutes for capability."],
  ["Reveal complexity progressively", "Start with the next safe action; expose advanced configuration when it becomes relevant."],
  ["State boundaries plainly", "Released, configured, preview, and simulated states must look and read differently."],
  ["Preserve control", "Writes, deployment, and production authority stay visible, scoped, and approval-gated."],
] as const;

export default function DesignPage() {
  return (
    <div className="axiom-canvas min-h-screen bg-[#0a0908] text-zinc-100">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1240px] px-5 pb-16 pt-28 sm:px-8 lg:pt-36">
          <PageHero
            eyebrow="Design system"
            title="Complexity belongs in the capability."
            muted="Not in the interface."
            lead={<>V19 uses a quiet neutral system, clear contrast, direct
              language, and motion only when it explains a state change.</>}
          />
        </section>

        <section className="border-y border-white/8 bg-[#171615]">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
              <div>
                <p className="font-mono text-xs text-zinc-600">01</p>
                <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">Color</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  Near-black structure, white primary type, and warm neutral
                  supporting text. Original artwork keeps its own colors.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 sm:grid-cols-2">
                {colors.map(([name, hex]) => (
                  <div key={name} className="bg-[#0a0908] p-5">
                    <div className="h-24 rounded-xl border border-white/10" style={{ backgroundColor: hex }} />
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

        <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="font-mono text-xs text-zinc-600">02</p>
              <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">Type and rhythm</h2>
            </div>
            <div className="space-y-10 border-y border-white/8 py-8">
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

        <section className="border-y border-white/8 bg-[#171615]">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-24">
            <p className="font-mono text-xs text-zinc-600">03</p>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">Interaction rules</h2>
            <div className="mt-10 divide-y divide-white/8 border-y border-white/8">
              {principles.map(([title, detail]) => (
                <div key={title} className="grid gap-3 py-6 md:grid-cols-[260px_1fr]">
                  <h3 className="font-medium">{title}</h3>
                  <p className="max-w-2xl text-sm leading-6 text-zinc-500">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1240px] flex-col gap-7 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-28">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">See it applied</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
              Watch the workflow explain itself.
            </h2>
          </div>
          <Link href="/demo" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#efefec] px-6 text-sm font-semibold text-brand-ink hover:bg-white">
            Explore the interactive demo
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
