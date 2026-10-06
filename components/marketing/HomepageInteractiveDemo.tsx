"use client";

/**
 * HomepageInteractiveDemo — a real, click-through preview of the
 * first_time_workspace_setup sandbox scenario, embedded directly on the
 * homepage (the same honest "SANDBOX · example only" scripted-data
 * pattern as /demo — see app/demo/page.tsx and lib/demo/demoScenarios.ts).
 *
 * This is not a passive screenshot or a fabricated animation: it renders
 * the real scenario steps through the same StepVisual mock-UI renderer
 * /demo uses, with real next/prev interactivity. It intentionally stops
 * short of the full scenario and links out to /demo for the rest, so the
 * homepage stays lightweight.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { DEMO_SCENARIOS } from "@/lib/demo/demoScenarios";
import { StepVisual } from "@/app/demo/[id]/StepVisual";

const SCENARIO = DEMO_SCENARIOS.first_time_workspace_setup;
const PREVIEW_STEP_COUNT = 3;
const previewSteps = SCENARIO.steps.slice(0, PREVIEW_STEP_COUNT);

export function HomepageInteractiveDemo() {
  const [activeOrd, setActiveOrd] = useState(0);
  const step = previewSteps[activeOrd]!;

  return (
    <div className="relative mt-14 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#171714] p-3 shadow-2xl shadow-black/30 sm:p-5 lg:mt-16 lg:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-coral/30 bg-brand-coral/[0.08] px-3 py-1.5 text-[11px] font-medium text-zinc-200">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-brand-coral/90">SANDBOX</span>
          <span className="text-zinc-500">·</span>
          example only
        </span>
        <p className="text-[13px] text-zinc-400">{SCENARIO.pitch}</p>
      </div>

      <StepVisual step={step} ord={activeOrd} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {previewSteps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveOrd(i)}
              aria-current={i === activeOrd}
              aria-label={`Step ${i + 1}: ${s.title}`}
              className={`h-2 w-2 rounded-full transition ${
                i === activeOrd ? "bg-brand-coral" : "bg-white/15 hover:bg-white/30"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveOrd((o) => Math.max(o - 1, 0))}
            disabled={activeOrd === 0}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] disabled:opacity-30"
          >
            Back
          </button>
          {activeOrd < previewSteps.length - 1 ? (
            <button
              type="button"
              onClick={() => setActiveOrd((o) => Math.min(o + 1, previewSteps.length - 1))}
              className="rounded-full bg-[#efefec] px-4 py-2 text-xs font-semibold text-[#151513] hover:bg-white"
            >
              Next step
            </button>
          ) : (
            <Link
              href={`/demo/${SCENARIO.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#efefec] px-4 py-2 text-xs font-semibold text-[#151513] hover:bg-white"
            >
              Continue in full demo <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
