"use client";

type WhatWeDoNotDoProps = {
  focusTitle?: string;
  focusItems: string[];
  notDoTitle?: string;
  notDoItems: string[];
};

export function WhatWeDoNotDo({
  focusTitle = "We focus on",
  focusItems,
  notDoTitle = "We do not",
  notDoItems,
}: WhatWeDoNotDoProps) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">
        Scope and boundaries
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-3xl">
        Clear scope builds credibility. We are explicit about what we do and what we do not do.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="card-hover bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 border-l-4 border-l-indigo-600 dark:border-l-indigo-500">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {focusTitle}
          </h3>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {focusItems.map((item) => (
              <li key={item} className="flex items-start">
                <span className="text-indigo-500 mr-2 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="card-hover bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 border-l-4 border-l-slate-400 dark:border-l-slate-500">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {notDoTitle}
          </h3>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {notDoItems.map((item) => (
              <li key={item} className="flex items-start">
                <span className="text-slate-400 mr-2 mt-0.5">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
