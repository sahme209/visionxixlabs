"use client";

import { ShieldExclamationIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { LockClosedIcon, CodeBracketIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import type { SecurityAccessBlock } from "../lib/engineeringContent";

const blockIcons = [LockClosedIcon, CodeBracketIcon, ClipboardDocumentCheckIcon];

type SecurityAccessSectionProps = {
  title?: string;
  weDoNot: string[];
  weOperateUsing: string[];
  blocks: SecurityAccessBlock[];
};

export function SecurityAccessSection({
  title = "Security & access model",
  weDoNot,
  weOperateUsing,
  blocks,
}: SecurityAccessSectionProps) {
  return (
    <section className="mb-16" aria-labelledby="security-access-heading">
      <div className="mb-10">
        <h2 id="security-access-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {title}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
          We engage with client environments in a secure, professional, and enterprise-ready manner.
        </p>
      </div>

      {/* We do NOT / We operate using */}
      <div className="grid gap-6 md:grid-cols-2 mb-10">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldExclamationIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              We do not
            </h3>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            {weDoNot.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="text-slate-400 dark:text-slate-500 mt-0.5">×</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              We operate using
            </h3>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            {weOperateUsing.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Three structured blocks */}
      <div className="grid gap-6 md:grid-cols-3">
        {blocks.map((block, index) => {
          const Icon = blockIcons[index] ?? ClipboardDocumentCheckIcon;
          return (
            <div
              key={block.title}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {block.title}
                </h3>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                {block.items.map((item) => (
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
