"use client";

import type { TechnicalSection as TechnicalSectionType } from "../lib/engineeringContent";

export function TechnicalSection({
  title,
  intro,
  subsections,
}: TechnicalSectionType) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
        {title}
      </h2>
      {intro && (
        <p className="text-zinc-400 mb-8 max-w-3xl">
          {intro}
        </p>
      )}
      <div className="space-y-8">
        {subsections.map((sub) => (
          <div
            key={sub.title}
            className="card-hover bg-white/[0.02] rounded-xl p-6 shadow-lg border border-white/[0.06]"
          >
            <h3 className="text-lg font-semibold text-white mb-3">
              {sub.title}
            </h3>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              {sub.items.map((item) => (
                <li key={item} className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
