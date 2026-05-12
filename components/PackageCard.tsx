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
    <div className="card-hover bg-white/[0.02] rounded-2xl p-6 shadow-xl border border-white/[0.06] flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">
          {name}
        </h3>
        {duration ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 shrink-0 ml-2">
            {duration}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-zinc-400 mb-4">
          {description}
        </p>
      ) : null}
      <div className="mb-4">
        <p className="text-xs font-medium text-zinc-500 mb-1">
          Includes
        </p>
        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
          {includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="mt-auto text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">
          Best for:
        </span>{" "}
        {bestFor}
      </p>
      <div className="mt-4">
        <Link
          href={ctaHref}
          className="w-full inline-flex items-center justify-center rounded-xl bg-white text-zinc-900 px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

