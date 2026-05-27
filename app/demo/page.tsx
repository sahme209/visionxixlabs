/**
 * /demo — Phase 405 sandbox landing.
 *
 * The shared explore workspace. Every demo flow listed here uses ONLY
 * the seed scenarios in lib/demo/demoScenarios.ts — no real workspace
 * data, no real billing. Huly-style coral aurora makes the sandbox
 * feel premium without changing the "this is scripted" safety messaging.
 *
 * Demo data is gated behind `isSandboxWorkspace()` at every data-access
 * boundary (lib/workspace/workspaceKind.ts). Even if a real-workspace
 * id leaks into a demo-data path, assertNotDemoLeak() throws.
 */

import Link from "next/link";
import { ArrowRightIcon, PlayCircleIcon, BookOpenIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { listScenarios, type DemoScenario } from "@/lib/demo/demoScenarios";

export const dynamic = "force-dynamic";

export default function DemoLanding() {
  // Sandbox = client-tier visibility (matches what a paid customer can see).
  const scenarios = listScenarios("client");

  return (
    <main className="relative max-w-6xl mx-auto px-6 md:px-10 py-16 space-y-10">
      {/* Coral × violet aurora — Huly-style warm wash behind the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-[520px] -z-10 overflow-hidden">
        <div className="ambient-drift absolute -top-24 left-1/2 -translate-x-1/2 w-[860px] h-[440px] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
        <div className="ambient-drift absolute top-12 right-[5%] w-[460px] h-[340px] rounded-full bg-brand-coral/[0.07] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute top-20 left-[5%] w-[380px] h-[280px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* Hero */}
      <section className="relative">
        <div className="flex items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-coral/30 bg-gradient-to-r from-brand-coral/[0.10] via-fuchsia-500/[0.06] to-brand-violet/[0.10] text-[11.5px] font-medium text-zinc-200 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-coral opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-coral" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-brand-coral/90">SANDBOX</span>
            <span className="text-zinc-500">·</span>
            example only
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-[-0.04em] leading-[1.04] mb-5">
          See VisionXIXLabs{" "}
          <span className="relative inline-block">
            in motion.
            <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-[88%] rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-90" />
          </span>
        </h1>

        <p className="text-[15.5px] text-zinc-400 max-w-2xl leading-relaxed mb-8">
          Every screen below uses scripted example data. Nothing here touches a real cloud account
          or burns AI credits. Pick a scenario to walk through one of the {scenarios.length} core product flows.
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link
            href="/dashboard/start-here"
            className="btn-coral-glow magnetic-sheen inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold"
          >
            Ready for your real workspace?
            <ArrowRightIcon className="h-4 w-4 opacity-60" />
          </Link>
          <Link
            href="/demo/reference"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full border border-brand-coral/25 bg-brand-coral/[0.05] text-zinc-200 text-[13.5px] font-medium hover:bg-brand-coral/[0.10] hover:border-brand-coral/45 transition-all"
          >
            <BookOpenIcon className="h-4 w-4 text-brand-coral/80" />
            Platform reference
          </Link>
          <Link
            href="/docs"
            className="link-underline-soft text-[13.5px] text-zinc-400 hover:text-brand-coral transition-colors"
          >
            Read documentation
          </Link>
        </div>
      </section>

      {/* Coral divider */}
      <div className="hairline-divider-coral" />

      {/* Scenarios */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
          <span className="text-brand-coral/90 tabular-nums">02</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Demo scenarios · {scenarios.length}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.03em] mb-7 leading-tight">
          Pick a story. Walk through it.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenarios.map((s, i) => <ScenarioCard key={s.id} scenario={s} index={i} />)}
        </div>
      </section>

      {/* Safety */}
      <section className="rounded-2xl border border-brand-coral/15 bg-gradient-to-br from-brand-coral/[0.04] via-brand-violet/[0.025] to-transparent p-6 space-y-3">
        <header className="flex items-center gap-2">
          <ShieldCheckIcon className="h-4 w-4 text-brand-coral/80" />
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-brand-coral/90">
            How the sandbox stays isolated
          </p>
        </header>
        <ul className="space-y-1.5 text-[13px] text-zinc-300 leading-relaxed">
          <li>· Every demo data path is gated by <code className="font-mono text-brand-coral/80">isSandboxWorkspace()</code> — a closed-union check on the workspace id prefix.</li>
          <li>· <code className="font-mono text-brand-coral/80">assertNotDemoLeak()</code> throws at the boundary if a real workspace ever asks for demo content.</li>
          <li>· Scenarios live in source control (<code className="font-mono text-zinc-300">lib/demo/demoScenarios.ts</code>), not the workspace database. They can&apos;t bleed across tenants.</li>
          <li>· No connector credentials are stored. No webhooks fire. No AI tokens are spent.</li>
        </ul>
      </section>
    </main>
  );
}

function ScenarioCard({ scenario, index }: { scenario: DemoScenario; index: number }) {
  return (
    <Link
      href={`/demo/${scenario.id}`}
      className="group relative rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 hover:border-brand-coral/30 hover:bg-brand-coral/[0.04] transition-all overflow-hidden"
    >
      {/* Subtle coral halo on hover */}
      <span
        aria-hidden
        className="absolute -inset-px rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "radial-gradient(60% 80% at 0% 0%, rgba(244,114,182,0.10), transparent 60%)" }}
      />
      <div className="relative flex items-baseline justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono tabular-nums text-brand-coral/70 group-hover:text-brand-coral transition-colors">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-[14.5px] font-semibold text-white group-hover:text-white transition-colors truncate">
            {scenario.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 whitespace-nowrap">~{scenario.estimatedMinutes} min</span>
      </div>
      <p className="relative text-[12.5px] text-zinc-400 leading-relaxed mb-3">{scenario.pitch}</p>
      <div className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono text-zinc-500 group-hover:text-brand-coral/90 transition-colors">
          <PlayCircleIcon className="h-3 w-3" />
          {scenario.steps.length} steps
        </span>
        <span className="text-[10px] font-mono text-zinc-600">reviewed · {scenario.lastReviewed}</span>
      </div>
    </Link>
  );
}
