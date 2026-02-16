"use client";

import type { UseCase } from "../lib/engineeringContent";

export function UseCaseCard({ title, problem, approach, outcome }: UseCase) {
  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h3>
      <div className="space-y-3 text-sm flex-1">
        <div>
          <span className="font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide text-xs">
            Problem
          </span>
          <p className="text-slate-700 dark:text-slate-300 mt-1">{problem}</p>
        </div>
        <div>
          <span className="font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide text-xs">
            Approach
          </span>
          <p className="text-slate-700 dark:text-slate-300 mt-1">{approach}</p>
        </div>
        <div>
          <span className="font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide text-xs">
            Outcome
          </span>
          <p className="text-slate-700 dark:text-slate-300 mt-1">{outcome}</p>
        </div>
      </div>
    </div>
  );
}
