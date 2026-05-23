/**
 * /demo — Phase 405 sandbox landing.
 *
 * The shared explore workspace. Every demo flow listed here uses ONLY
 * the seed scenarios in lib/demo/demoScenarios.ts — no real workspace
 * data, no real billing. The big violet "SANDBOX" banner makes the
 * mode unmistakable.
 *
 * Demo data is gated behind `isSandboxWorkspace()` at every data-access
 * boundary (lib/workspace/workspaceKind.ts). Even if a real-workspace
 * id leaks into a demo-data path, assertNotDemoLeak() throws.
 */

import Link from "next/link";
import { listScenarios, type DemoScenario } from "@/lib/demo/demoScenarios";

export const dynamic = "force-dynamic";

export default function DemoLanding() {
  // Sandbox = client-tier visibility (matches what a paid customer can see).
  const scenarios = listScenarios("client");

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.12] via-fuchsia-500/[0.06] to-cyan-500/[0.04] p-6 overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.22em] font-semibold">sandbox · example only</span>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">VisionXIXLabs Demo Workspace</h1>
        <p className="text-zinc-300 max-w-2xl leading-relaxed">
          Every screen below uses scripted example data. Nothing here touches a real cloud account
          or burns AI credits. Pick a scenario to walk through one of the {scenarios.length} core
          product flows.
        </p>
        <div className="flex items-center gap-2 pt-4 flex-wrap">
          <Link
            href="/dashboard/start-here"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium transition-colors"
          >
            Ready to set up your real workspace? →
          </Link>
          <Link
            href="/demo/reference"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white/[0.04] text-zinc-200 text-[13px] font-medium border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
          >
            Platform reference →
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white/[0.04] text-zinc-200 text-[13px] font-medium border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
          >
            Read documentation
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em] mb-3">
          // demo scenarios · {scenarios.length}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenarios.map((s) => <ScenarioCard key={s.id} scenario={s} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-2">
        <h2 className="text-sm font-semibold text-white">How the sandbox stays isolated</h2>
        <ul className="space-y-1 text-[12.5px] text-zinc-400 leading-relaxed">
          <li>· Every demo data path is gated by <code className="font-mono text-zinc-300">isSandboxWorkspace()</code> — a closed-union check on the workspace id prefix.</li>
          <li>· <code className="font-mono text-zinc-300">assertNotDemoLeak()</code> throws at the boundary if a real workspace ever asks for demo content.</li>
          <li>· Scenarios live in source control (<code className="font-mono text-zinc-300">lib/demo/demoScenarios.ts</code>), not the workspace database. They can&apos;t bleed across tenants.</li>
          <li>· No connector credentials are stored. No webhooks fire. No AI tokens are spent.</li>
        </ul>
      </section>
    </main>
  );
}

function ScenarioCard({ scenario }: { scenario: DemoScenario }) {
  return (
    <Link
      href={`/demo/${scenario.id}`}
      className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:border-violet-500/30 hover:bg-violet-500/[0.04] transition-all group"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-[14px] font-semibold text-white group-hover:text-violet-200 transition-colors">{scenario.title}</h3>
        <span className="text-[10px] font-mono text-zinc-600">~{scenario.estimatedMinutes} min</span>
      </div>
      <p className="text-[12px] text-zinc-400 leading-relaxed mb-3">{scenario.pitch}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-zinc-600">{scenario.steps.length} steps</span>
        <span className="text-[10px] font-mono text-zinc-600">last reviewed · {scenario.lastReviewed}</span>
      </div>
    </Link>
  );
}
