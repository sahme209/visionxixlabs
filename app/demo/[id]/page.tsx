/**
 * /demo/[id] — Phase 405 per-scenario walkthrough.
 *
 * Renders one scenario from the lib/demo/demoScenarios.ts registry as a
 * step-by-step page. Closed-union DemoScenarioId means a typo in the
 * URL returns Next.js's standard 404 instead of an opaque empty page.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getScenario,
  isDemoScenarioId,
  type DemoStep,
} from "@/lib/demo/demoScenarios";

export const dynamic = "force-dynamic";

export default async function DemoScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDemoScenarioId(id)) {
    notFound();
  }
  // The narrowing predicate makes id safe to cast.
  const scenario = getScenario(id as Parameters<typeof getScenario>[0]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      {/* Sandbox marker — always visible. */}
      <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.22em]">
          sandbox · example only · not your workspace
        </span>
      </div>

      <header className="space-y-2">
        <Link href="/demo" className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors">
          ← all scenarios
        </Link>
        <h1 className="text-3xl font-bold text-white tracking-tight">{scenario.title}</h1>
        <p className="text-zinc-400 leading-relaxed max-w-2xl">{scenario.description}</p>
        <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-zinc-500">
          <span>{scenario.steps.length} steps</span>
          <span>·</span>
          <span>~{scenario.estimatedMinutes} min</span>
          <span>·</span>
          <span>audience · {scenario.audience}</span>
          <span>·</span>
          <span>last reviewed · {scenario.lastReviewed}</span>
        </div>
      </header>

      <ol className="space-y-2">
        {scenario.steps.map((step, idx) => (
          <StepCard key={step.id} step={step} ord={idx + 1} />
        ))}
      </ol>

      <footer className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5">
        <p className="text-sm text-zinc-300">
          Ready to do this on your real workspace?{" "}
          <Link
            href="/dashboard/start-here"
            className="text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
          >
            Open the setup guide →
          </Link>
        </p>
      </footer>
    </main>
  );
}

const APPROVAL_TONE: Record<DemoStep["approval"], { label: string; cls: string }> = {
  none:          { label: "No approval needed",         cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  self_approve:  { label: "Operator self-approves",     cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  two_person:    { label: "Two-person human approval",  cls: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
};

function StepCard({ step, ord }: { step: DemoStep; ord: number }) {
  const tone = APPROVAL_TONE[step.approval];
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:border-white/[0.10] transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-[10px] font-mono text-zinc-600 tabular-nums mt-1 w-6 shrink-0">
          {String(ord).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h2 className="text-[15px] font-semibold text-white">{step.title}</h2>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${tone.cls}`}>
              {tone.label}
            </span>
          </div>
          <p className="text-[13px] text-zinc-400 leading-relaxed">{step.description}</p>
          <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2">
            <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.18em] mb-0.5">
              expected result
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed">{step.expectedResult}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-zinc-600 pt-1">
            {step.route && (
              <span>
                route ·{" "}
                <Link href={step.route} className="text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline">
                  {step.route}
                </Link>
              </span>
            )}
            {step.relatedAgent  && <span>agent · {step.relatedAgent}</span>}
            {step.relatedConnector && <span>connector · {step.relatedConnector}</span>}
          </div>
        </div>
      </div>
    </li>
  );
}
