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
    <div className="card-hover bg-white/[0.02] rounded-2xl p-6 shadow-xl border border-white/[0.06] flex flex-col h-full">
      <div className="flex-1">
        <h3 className="text-xl font-semibold text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          {description}
        </p>
        <p className="text-xs font-medium text-zinc-500">
          <span className="uppercase tracking-wide text-zinc-500">
            Best for:
          </span>{" "}
          {bestFor}
        </p>
      </div>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center text-sm font-semibold text-violet-400 hover:text-violet-300"
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

