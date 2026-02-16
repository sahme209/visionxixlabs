"use client";

import type { FAQ } from "../lib/cloudContent";

type FAQAccordionProps = {
  items: FAQ[];
};

export function FAQAccordion({ items }: FAQAccordionProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details
          key={item.question}
          className="group card-hover bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-lg border border-slate-200 dark:border-slate-700"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">
              {item.question}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-slate-500 text-xs group-open:rotate-90 transition-transform">
              +
            </span>
          </summary>
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}

