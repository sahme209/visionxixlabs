"use client";

import {
  MagnifyingGlassIcon,
  KeyIcon,
  CubeIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { HowWeWorkPhase } from "../lib/engineeringContent";

const phaseIcons = [
  MagnifyingGlassIcon,
  KeyIcon,
  CubeIcon,
  CheckCircleIcon,
  ArrowPathIcon,
];

type HowWeWorkSectionProps = {
  title?: string;
  intro?: string;
  phases: HowWeWorkPhase[];
};

export function HowWeWorkSection({
  title = "How we work",
  intro = "A structured five-phase engagement so you know exactly how we operate and what to expect.",
  phases,
}: HowWeWorkSectionProps) {
  return (
    <section className="mb-16" aria-labelledby="how-we-work-heading">
      <div className="mb-10">
        <h2 id="how-we-work-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {title}
        </h2>
        {intro && (
          <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
            {intro}
          </p>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {phases.map((p) => {
          const Icon = phaseIcons[p.phase - 1] ?? CubeIcon;
          return (
            <div
              key={p.phase}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    Phase {p.phase}
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {p.title}
                  </h3>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                {p.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
