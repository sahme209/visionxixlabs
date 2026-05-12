"use client";

import type { ComparisonRow } from "../lib/engineeringContent";

type ComparisonTableProps = {
  title: string;
  rows: ComparisonRow[];
};

export function ComparisonTable({ title, rows }: ComparisonTableProps) {
  return (
    <section className="mb-16 overflow-x-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        {title}
      </h2>
      <p className="text-zinc-400 mb-6 max-w-3xl">
        High-level comparison across providers. We tailor implementation to the platform you use.
      </p>
      <div className="border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-white/[0.03]/80 border-b border-white/[0.06]">
              <th className="px-4 py-3 font-semibold text-white w-1/4">
                Dimension
              </th>
              <th className="px-4 py-3 font-semibold text-white">
                AWS
              </th>
              <th className="px-4 py-3 font-semibold text-white">
                Azure
              </th>
              <th className="px-4 py-3 font-semibold text-white">
                GCP
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.dimension}
                className="border-b border-white/[0.06] last:border-0"
              >
                <td className="px-4 py-3 font-medium text-zinc-300">
                  {row.dimension}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {row.aws}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {row.azure}
                </td>
                <td className="px-4 py-3 text-zinc-400">
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
