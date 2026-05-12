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
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
        Scope and boundaries
      </h2>
      <p className="text-zinc-400 mb-8 max-w-3xl">
        Clear scope builds credibility. We are explicit about what we do and what we do not do.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="card-hover bg-white/[0.02] rounded-xl p-6 shadow-lg border border-white/[0.06] border-l-4 border-l-violet-500">
          <h3 className="text-lg font-semibold text-white mb-3">
            {focusTitle}
          </h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {focusItems.map((item) => (
              <li key={item} className="flex items-start">
                <span className="text-indigo-500 mr-2 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="card-hover bg-white/[0.02] rounded-xl p-6 shadow-lg border border-white/[0.06] border-l-4 border-l-zinc-600">
          <h3 className="text-lg font-semibold text-white mb-3">
            {notDoTitle}
          </h3>
          <ul className="space-y-2 text-sm text-zinc-300">
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
