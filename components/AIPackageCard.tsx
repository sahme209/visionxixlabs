"use client";

import Link from "next/link";
import type { AIPackage } from "../lib/aiContent";

export function AIPackageCard({
  name,
  duration,
  includes,
  bestFor,
}: AIPackage) {
  return (
    <div className="card-hover bg-white/[0.02] rounded-2xl p-6 shadow-xl border border-white/[0.06] flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">
          {name}
        </h3>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400">
          {duration}
        </span>
      </div>
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
      <p className="mt-auto text-xs text-zinc-500 mb-4">
        <span className="font-semibold text-zinc-300">
          Best for:
        </span>{" "}
        {bestFor}
      </p>
      <Link
        href="/contact"
        className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
      >
        Talk to us
      </Link>
    </div>
  );
}
