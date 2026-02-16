"use client";

import type { AIProcessStep as AIProcessStepType } from "../lib/aiContent";

export function AIProcessStep({
  step,
  title,
  description,
}: AIProcessStepType) {
  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
          {step}
        </span>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
