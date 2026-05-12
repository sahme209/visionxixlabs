"use client";

import type { AIProcessStep as AIProcessStepType } from "../lib/aiContent";

export function AIProcessStep({
  step,
  title,
  description,
}: AIProcessStepType) {
  return (
    <div className="card-hover bg-white/[0.02] rounded-2xl p-6 shadow-xl border border-white/[0.06]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className="text-xs font-bold text-zinc-500">
          {step}
        </span>
        <h3 className="text-lg font-semibold text-white">
          {title}
        </h3>
      </div>
      <p className="text-sm text-zinc-400">{description}</p>
    </div>
  );
}
