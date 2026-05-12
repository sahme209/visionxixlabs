"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import type { AISolutionCard as AISolutionCardType } from "../lib/aiContent";

export function AISolutionCard({
  title,
  description,
  bullets,
  href,
}: AISolutionCardType) {
  return (
    <div className="card-hover bg-white/[0.02] rounded-2xl p-6 md:p-8 shadow-xl border border-white/[0.06] flex flex-col h-full">
      <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
        {title}
      </h3>
      <p className="text-sm text-zinc-400 mb-4">
        {description}
      </p>
      <ul className="space-y-2 mb-6 flex-1">
        {bullets.map((item) => (
          <li
            key={item}
            className="text-sm text-zinc-400 flex items-start"
          >
            <span className="text-indigo-500 mr-2">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="inline-flex items-center text-sm font-semibold text-violet-400 hover:text-violet-300"
      >
        Learn more
        <ArrowRightIcon className="ml-1 h-4 w-4" />
      </Link>
    </div>
  );
}
