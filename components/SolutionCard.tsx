"use client";

import Link from "next/link";

type SolutionCardProps = {
  title: string;
  description: string;
  bestFor: string;
  href: string;
};

export function SolutionCard({
  title,
  description,
  bestFor,
  href,
}: SolutionCardProps) {
  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full">
      <div className="flex-1">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {description}
        </p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Best for:
          </span>{" "}
          {bestFor}
        </p>
      </div>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          View details
          <span aria-hidden="true" className="ml-1">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

