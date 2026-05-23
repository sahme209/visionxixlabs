"use client";

/**
 * DemoScenarioClient — interactive walkthrough for one demo scenario.
 *
 * Surfaces, in order:
 *   1. Sandbox marker (pinned, calm).
 *   2. Hero — scenario title + pitch + audience + everything-at-a-glance
 *      strip (steps, minutes, engineers, connectors, reviewed date).
 *   3. Architecture diagram — ASCII data-flow specific to this scenario.
 *   4. "Read first" doc reference + every doc the scenario touches.
 *   5. Active step: visual stage + knowledge card + safety invariants.
 *   6. Step navigation + clickable timeline.
 *   7. Closing knowledge nugget — "the engineering principle behind this."
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DemoScenario, DemoStep } from "@/lib/demo/demoScenarios";
import {
  SCENARIO_PRIMARY_DOCS,
  docsForScenario,
  docsForStep,
} from "@/lib/demo/scenarioDocLinks";
import {
  SCENARIO_CLOSERS,
  SCENARIO_DIAGRAMS,
  invariantsForStep,
  knowledgeForStep,
} from "@/lib/demo/scenarioKnowledge";
import { StepVisual } from "./StepVisual";

const APPROVAL_TONE: Record<DemoStep["approval"], { label: string; cls: string }> = {
  none:         { label: "No approval needed",        cls: "bg-emerald-500/10 text-emerald-200 border-emerald-500/25" },
  self_approve: { label: "Operator self-approves",    cls: "bg-amber-500/10 text-amber-200 border-amber-500/25" },
  two_person:   { label: "Two-person human approval", cls: "bg-violet-500/10 text-violet-200 border-violet-500/25" },
};

export function DemoScenarioClient({ scenario }: { scenario: DemoScenario }) {
  const [activeOrd, setActiveOrd] = useState(0);
  const step = scenario.steps[activeOrd]!;
  const stepDocs = useMemo(() => docsForStep(step), [step]);
  const allDocs = useMemo(() => docsForScenario(scenario), [scenario]);
  const primaryDoc = SCENARIO_PRIMARY_DOCS[scenario.id];
  const knowledge = useMemo(() => knowledgeForStep(scenario, step), [scenario, step]);
  const invariants = useMemo(() => invariantsForStep(step), [step]);

  const next = useCallback(
    () => setActiveOrd((o) => Math.min(o + 1, scenario.steps.length - 1)),
    [scenario.steps.length],
  );
  const prev = useCallback(
    () => setActiveOrd((o) => Math.max(o - 1, 0)),
    [],
  );

  // ←/→ scrub steps quickly across long scenarios.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Distinct engineers + connectors mentioned anywhere in the scenario.
  const engineers = useMemo(() => Array.from(new Set(
    scenario.steps.map((s) => s.relatedAgent).filter(Boolean) as string[],
  )), [scenario]);
  const connectors = useMemo(() => Array.from(new Set(
    scenario.steps
      .flatMap((s) => (s.relatedConnector ?? "").split("|"))
      .map((c) => c.trim())
      .filter(Boolean),
  )), [scenario]);

  const closer = SCENARIO_CLOSERS[scenario.id];
  const diagram = SCENARIO_DIAGRAMS[scenario.id];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Sandbox marker — pinned, calm. */}
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
        <span className="text-[10px] font-mono text-violet-200/90 uppercase tracking-[0.22em]">
          sandbox · example data only · not your workspace
        </span>
      </div>

      {/* Hero */}
      <header className="space-y-4">
        <Link href="/demo" className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors">
          ← all scenarios
        </Link>
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">{scenario.title}</h1>
          <p className="text-zinc-300 leading-relaxed max-w-3xl text-[15px]">{scenario.pitch}</p>
          <p className="text-zinc-400 leading-relaxed max-w-3xl text-[13px]">{scenario.description}</p>
        </div>

        {/* At-a-glance strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
          <FactCell label="Steps" value={String(scenario.steps.length)} />
          <FactCell label="Est. time" value={`~${scenario.estimatedMinutes} min`} />
          <FactCell label="Audience" value={scenario.audience} />
          <FactCell label="Reviewed" value={scenario.lastReviewed} />
        </div>

        {/* Engineer + connector chips. */}
        {(engineers.length > 0 || connectors.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {engineers.map((e) => (
              <span key={e} className="text-[10px] font-mono px-2 py-1 rounded-full border border-violet-500/25 bg-violet-500/[0.04] text-violet-200/90">
                engineer · {e}
              </span>
            ))}
            {connectors.map((c) => (
              <span key={c} className="text-[10px] font-mono px-2 py-1 rounded-full border border-cyan-500/25 bg-cyan-500/[0.04] text-cyan-200/90">
                connector · {c}
              </span>
            ))}
          </div>
        )}

        {/* Read-first doc + every doc the scenario covers. */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-2">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em]">read first</p>
          <Link
            href={primaryDoc.href}
            className="inline-flex items-baseline gap-2 text-[14px] font-semibold text-white hover:text-violet-200 transition-colors"
          >
            {primaryDoc.title}
            <span className="text-zinc-500 text-[12px] font-normal">— {primaryDoc.blurb}</span>
          </Link>
          {allDocs.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {allDocs.filter((d) => d.href !== primaryDoc.href).map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                  title={d.blurb}
                >
                  {d.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Architecture diagram — ASCII flow, no chart library. */}
      {diagram && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em]">data flow</p>
            <p className="text-[10px] font-mono text-zinc-600">scenario architecture</p>
          </div>
          <pre className="text-[11px] sm:text-[12px] font-mono text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre">{diagram}</pre>
        </section>
      )}

      {/* Two-column layout: visual + timeline. Stacks on narrow screens. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section className="space-y-5">
          {/* Active step number + nav */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <span className="text-violet-300 font-semibold">step {activeOrd + 1}</span>
              <span className="text-zinc-700">/</span>
              <span>{scenario.steps.length}</span>
              <span className="text-zinc-700 mx-1">·</span>
              <span className={`px-1.5 py-0.5 rounded border ${APPROVAL_TONE[step.approval].cls}`}>{APPROVAL_TONE[step.approval].label}</span>
            </div>
            <div className="flex items-center gap-2">
              <NavButton onClick={prev} disabled={activeOrd === 0}>← Prev</NavButton>
              <NavButton onClick={next} disabled={activeOrd === scenario.steps.length - 1}>Next →</NavButton>
            </div>
          </div>

          {/* Title + description */}
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">{step.title}</h2>
            <p className="text-zinc-400 leading-relaxed text-[13px] max-w-2xl">{step.description}</p>
          </div>

          {/* Visual stage */}
          <StepVisual step={step} ord={activeOrd + 1} />

          {/* Knowledge card — "behind the scenes" educational copy */}
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.03] p-4 space-y-1.5">
            <p className="text-[10px] font-mono text-violet-300/90 uppercase tracking-[0.22em]">{knowledge.title}</p>
            <p className="text-[13px] text-zinc-300 leading-relaxed max-w-3xl">{knowledge.body}</p>
          </div>

          {/* Safety invariants — what's guaranteed during this step */}
          {invariants.length > 0 && (
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4 space-y-2">
              <p className="text-[10px] font-mono text-emerald-300/90 uppercase tracking-[0.22em]">safety invariants in play</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {invariants.map((inv) => (
                  <li key={inv.label} className="flex items-start gap-2 text-[12px] text-zinc-300 leading-relaxed">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>
                      <span className="text-white font-medium">{inv.label}</span>{" "}
                      <span className="text-zinc-500">— {inv.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expected result */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em] mb-1">expected result</p>
            <p className="text-[13px] text-zinc-200 leading-relaxed max-w-3xl">{step.expectedResult}</p>
          </div>

          {/* Per-step deep-links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {step.route && (
              <Link
                href={step.route}
                className="block rounded-xl border border-white/[0.06] bg-white/[0.015] hover:border-violet-500/25 hover:bg-violet-500/[0.04] p-3 transition-colors group"
              >
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">platform route</p>
                <p className="text-[12px] font-mono text-violet-200/90 group-hover:text-violet-100 transition-colors break-all">{step.route} →</p>
              </Link>
            )}
            {stepDocs.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1.5">read more</p>
                <div className="flex flex-wrap gap-1.5">
                  {stepDocs.map((d) => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className="text-[11px] font-mono text-zinc-200 hover:text-white underline-offset-2 hover:underline"
                      title={d.blurb}
                    >
                      {d.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <NavButton onClick={prev} disabled={activeOrd === 0}>← Prev</NavButton>
            <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">use ← / → to navigate</span>
            {activeOrd === scenario.steps.length - 1 ? (
              <Link
                href="/dashboard/start-here"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white text-[12px] font-semibold transition-colors"
              >
                Try this for real →
              </Link>
            ) : (
              <NavButton onClick={next} disabled={false}>Next →</NavButton>
            )}
          </div>
        </section>

        {/* Timeline — clickable steps */}
        <aside className="lg:sticky lg:top-6 self-start space-y-3">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em]">walkthrough</p>
          <ol className="space-y-1">
            {scenario.steps.map((s, i) => {
              const isActive = i === activeOrd;
              const isDone = i < activeOrd;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActiveOrd(i)}
                    className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                      isActive ? "bg-violet-500/[0.08] border border-violet-500/25" :
                      isDone   ? "bg-white/[0.015] border border-emerald-500/15 hover:bg-white/[0.03]" :
                                 "bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                      isActive ? "bg-violet-500/25 text-violet-100 border border-violet-500/35" :
                      isDone   ? "bg-emerald-500/20 text-emerald-100" :
                                 "bg-zinc-800 text-zinc-500"
                    }`}>{isDone ? "✓" : i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12px] truncate leading-snug ${isActive ? "text-white font-medium" : "text-zinc-300"}`}>{s.title}</div>
                      {s.relatedAgent && (
                        <div className="text-[10px] font-mono text-zinc-500 truncate">{s.relatedAgent}</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          {scenario.sourceFeatureVersion && (
            <div className="pt-2 text-[10px] font-mono text-zinc-600">
              source · {scenario.sourceFeatureVersion}
            </div>
          )}
        </aside>
      </div>

      {/* Closing knowledge — engineering principle takeaway */}
      <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent p-5 sm:p-6 space-y-2">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em]">engineering principle</p>
        <p className="text-[14px] text-zinc-200 leading-relaxed max-w-3xl">{closer}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/docs/architecture" className="text-[12px] text-violet-300/90 hover:text-violet-200 underline-offset-2 hover:underline">
            Architecture overview →
          </Link>
          <Link href="/demo" className="text-[12px] text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline">
            ← Back to all scenarios
          </Link>
          <Link href="/dashboard/start-here" className="text-[12px] text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline">
            Set up your real workspace →
          </Link>
        </div>
      </section>
    </main>
  );
}

function FactCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2">
      <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{label}</div>
      <div className="text-[13px] font-mono text-zinc-200 mt-0.5">{value}</div>
    </div>
  );
}

function NavButton({
  children, disabled, onClick,
}: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] text-zinc-200 text-[12px] font-medium hover:bg-white/[0.06] hover:border-white/[0.14] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
