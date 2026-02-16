"use client";

import Link from "next/link";

type PackageCardProps = {
  name: string;
  duration?: string;
  description?: string;
  includes: string[];
  bestFor: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function PackageCard({
  name,
  duration,
  description,
  includes,
  bestFor,
  ctaHref = "/contact",
  ctaLabel = "Talk to us",
}: PackageCardProps) {
  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {name}
        </h3>
        {duration ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shrink-0 ml-2">
            {duration}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {description}
        </p>
      ) : null}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Includes
        </p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
          {includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="mt-auto text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          Best for:
        </span>{" "}
        {bestFor}
      </p>
      <div className="mt-4">
        <Link
          href={ctaHref}
          className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

