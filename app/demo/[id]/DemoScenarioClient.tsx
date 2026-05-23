"use client";

/**
 * DemoScenarioClient — interactive walkthrough for one demo scenario.
 *
 * Replaces the old static step-list with a visual end-to-end demo:
 *   - Hero: scenario title + pitch + audience + every doc reference.
 *   - Stage: a mock UI panel (browser chrome + per-kind visual) for the
 *     currently selected step.
 *   - Per-step details: description, expected result, approval gate,
 *     related engineer + connector, route deep-link, docs deep-links.
 *   - Vertical timeline on the right: every step clickable with progress.
 *   - Prev / Next + Cmd←/→ keyboard nav.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DemoScenario, DemoStep } from "@/lib/demo/demoScenarios";
import {
  SCENARIO_PRIMARY_DOCS,
  docsForScenario,
  docsForStep,
} from "@/lib/demo/scenarioDocLinks";
import { StepVisual } from "./StepVisual";

const APPROVAL_TONE: Record<DemoStep["approval"], { label: string; cls: string }> = {
  none:         { label: "No approval needed",        cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  self_approve: { label: "Operator self-approves",    cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  two_person:   { label: "Two-person human approval", cls: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
};

export function DemoScenarioClient({ scenario }: { scenario: DemoScenario }) {
  const [activeOrd, setActiveOrd] = useState(0);
  const step = scenario.steps[activeOrd]!;
  const stepDocs = useMemo(() => docsForStep(step), [step]);
  const allDocs = useMemo(() => docsForScenario(scenario), [scenario]);
  const primaryDoc = SCENARIO_PRIMARY_DOCS[scenario.id];

  const next = useCallback(
    () => setActiveOrd((o) => Math.min(o + 1, scenario.steps.length - 1)),
    [scenario.steps.length],
  );
  const prev = useCallback(
    () => setActiveOrd((o) => Math.max(o - 1, 0)),
    [],
  );

  // Cmd←/→ + arrow keys for fast scrubbing across long scenarios.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Distinct engineers + connectors mentioned anywhere in the scenario
  // — surfaced as chips in the hero so prospects can spot at a glance
  // which AI engineers are involved without scrubbing every step.
  const engineers = useMemo(() => Array.from(new Set(
    scenario.steps.map((s) => s.relatedAgent).filter(Boolean) as string[],
  )), [scenario]);
  const connectors = useMemo(() => Array.from(new Set(
    scenario.steps
      .flatMap((s) => (s.relatedConnector ?? "").split("|"))
      .map((c) => c.trim())
      .filter(Boolean),
  )), [scenario]);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Sandbox marker — always visible. */}
      <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.22em]">
          sandbox · example only · not your workspace
        </span>
      </div>

      {/* Header */}
      <header className="space-y-3">
        <Link href="/demo" className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors">
          ← all scenarios
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{scenario.title}</h1>
        <p className="text-zinc-300 leading-relaxed max-w-3xl text-[15px]">{scenario.pitch}</p>
        <p className="text-zinc-500 leading-relaxed max-w-3xl text-[13px]">{scenario.description}</p>

        <div className="flex items-center gap-3 flex-wrap pt-1 text-[11px] font-mono text-zinc-500">
          <span>{scenario.steps.length} steps</span>
          <span>·</span>
          <span>~{scenario.estimatedMinutes} min</span>
          <span>·</span>
          <span>audience · <span className="text-zinc-300">{scenario.audience}</span></span>
          <span>·</span>
          <span>reviewed · {scenario.lastReviewed}</span>
        </div>

        {/* Engineer + connector chips. */}
        {(engineers.length > 0 || connectors.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {engineers.map((e) => (
              <span key={e} className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/[0.06] text-violet-200">
                engineer · {e}
              </span>
            ))}
            {connectors.map((c) => (
              <span key={c} className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-200">
                connector · {c}
              </span>
            ))}
          </div>
        )}

        {/* Primary doc + every doc the scenario covers. */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 mt-3">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em]">read first</p>
          <Link
            href={primaryDoc.href}
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-white hover:text-violet-200 transition-colors"
          >
            {primaryDoc.title} <span className="text-zinc-500 text-[12px] font-normal">— {primaryDoc.blurb}</span>
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

      {/* Two-column layout: visual + timeline. Stacks on narrow screens. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section className="space-y-4">
          {/* Active step number + nav */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <span className="text-violet-300 font-semibold">step {activeOrd + 1}</span>
              <span>/</span>
              <span>{scenario.steps.length}</span>
              <span className="ml-2">·</span>
              <span className={`px-1.5 py-0.5 rounded border ${APPROVAL_TONE[step.approval].cls}`}>{APPROVAL_TONE[step.approval].label}</span>
            </div>
            <div className="flex items-center gap-2">
              <NavButton onClick={prev} disabled={activeOrd === 0}>← Prev</NavButton>
              <NavButton onClick={next} disabled={activeOrd === scenario.steps.length - 1}>Next →</NavButton>
            </div>
          </div>

          {/* Title + description for the active step */}
          <div className="space-y-1.5">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{step.title}</h2>
            <p className="text-zinc-400 leading-relaxed text-[13px]">{step.description}</p>
          </div>

          {/* Visual stage */}
          <StepVisual step={step} ord={activeOrd + 1} />

          {/* Expected result + metadata */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
            <p className="text-[10px] font-mono text-emerald-300 uppercase tracking-[0.22em] mb-1">expected result</p>
            <p className="text-[13px] text-zinc-200 leading-relaxed">{step.expectedResult}</p>
          </div>

          {/* Per-step deep-links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {step.route && (
              <Link
                href={step.route}
                className="block rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30 hover:bg-violet-500/[0.04] p-3 transition-colors group"
              >
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">platform route</p>
                <p className="text-[13px] font-mono text-violet-200 group-hover:text-violet-100 transition-colors">{step.route} →</p>
              </Link>
            )}
            {stepDocs.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
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

          {/* Bottom nav + Hint */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <NavButton onClick={prev} disabled={activeOrd === 0}>← Prev</NavButton>
            <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">use ← / → to navigate</span>
            {activeOrd === scenario.steps.length - 1 ? (
              <Link
                href="/dashboard/start-here"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-semibold transition-colors"
              >
                Try this for real →
              </Link>
            ) : (
              <NavButton onClick={next} disabled={false}>Next →</NavButton>
            )}
          </div>
        </section>

        {/* Timeline — clickable steps */}
        <aside className="lg:sticky lg:top-6 self-start space-y-2">
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
                      isActive ? "bg-violet-500/[0.10] border border-violet-500/30" :
                      isDone   ? "bg-white/[0.015] border border-emerald-500/15 hover:bg-white/[0.03]" :
                                 "bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                      isActive ? "bg-violet-500/30 text-violet-100 border border-violet-500/40" :
                      isDone   ? "bg-emerald-500/25 text-emerald-100" :
                                 "bg-zinc-800 text-zinc-500"
                    }`}>{isDone ? "✓" : i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12px] truncate ${isActive ? "text-white font-medium" : "text-zinc-300"}`}>{s.title}</div>
                      {s.relatedAgent && (
                        <div className="text-[10px] font-mono text-zinc-500 truncate">{s.relatedAgent}</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="pt-2 text-[10px] font-mono text-zinc-600">
            sourceFeatureVersion · {scenario.sourceFeatureVersion ?? "—"}
          </div>
        </aside>
      </div>
    </main>
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
      className="px-3 py-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] text-zinc-200 text-[12px] font-medium hover:bg-white/[0.07] hover:border-white/[0.16] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
