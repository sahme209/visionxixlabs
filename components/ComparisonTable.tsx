"use client";

import type { ComparisonRow } from "../lib/engineeringContent";

type ComparisonTableProps = {
  title: string;
  rows: ComparisonRow[];
};

export function ComparisonTable({ title, rows }: ComparisonTableProps) {
  return (
    <section className="mb-16 overflow-x-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
        High-level comparison across providers. We tailor implementation to the platform you use.
      </p>
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 w-1/4">
                Dimension
              </th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                AWS
              </th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                Azure
              </th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                GCP
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.dimension}
                className="border-b border-slate-200 dark:border-slate-700 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                  {row.dimension}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {row.aws}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {row.azure}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {row.gcp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
