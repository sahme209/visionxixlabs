"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FunnelIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";

type LeadRow = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  urgencyLevel: string;
  expansionProbability: number;
  enterpriseLikelihood: number;
  estimatedSavings: number | null;
  driftDetected: boolean;
  lastActivityAt: string;
  tags: string[];
  dealTimeline?: { recommendedFollowUpDays: number; idealEngagementModel: string };
};

export default function EnterpriseDashboardPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    highUrgency: false,
    tier: "",
    driftDetected: false,
    minSavings: "",
  });

  const load = () => {
    const params = new URLSearchParams();
    if (filters.highUrgency) params.set("highUrgency", "true");
    if (filters.tier) params.set("tier", filters.tier);
    if (filters.driftDetected) params.set("driftDetected", "true");
    if (filters.minSavings) params.set("minSavings", filters.minSavings);
    fetch(`/api/admin/enterprise-dashboard?${params}`)
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filters]);

  const urgencyColor = (u: string) => {
    if (u === "critical") return "bg-rose-500/10 text-rose-300 border-rose-500/20";
    if (u === "high") return "bg-white/10 text-zinc-300 border-white/20";
    if (u === "medium") return "bg-sky-500/10 text-sky-300 border-sky-500/20";
    return "bg-zinc-700/50 text-zinc-300 border-zinc-600/20";
  };

  return (
    <div>
      <Reveal direction="up" blur delay={0.05}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-[-0.04em]">
              Sales <span className="text-gradient">Intelligence</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Cloud Operator leads with deal signals. Internal CRM-lite.
            </p>
          </div>
          <Link
            href="/admin/leads"
            className="btn-huly text-sm text-violet-400 hover:underline"
          >
            Website Leads &rarr;
          </Link>
        </div>
      </Reveal>

      <Reveal direction="up" blur delay={0.1}>
        <div className="glass-card flex flex-wrap gap-2 mb-6 p-4 rounded-xl">
          <span className="text-xs font-medium text-zinc-500 flex items-center gap-1">
            <FunnelIcon className="h-4 w-4" /> Filters
          </span>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={filters.highUrgency}
              onChange={(e) => setFilters((f) => ({ ...f, highUrgency: e.target.checked }))}
              className="rounded border-white/[0.08] bg-white/[0.02]"
            />
            High urgency
          </label>
          <select
            value={filters.tier}
            onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value }))}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-sm text-zinc-300"
          >
            <option value="">All tiers</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={filters.driftDetected}
              onChange={(e) => setFilters((f) => ({ ...f, driftDetected: e.target.checked }))}
              className="rounded border-white/[0.08] bg-white/[0.02]"
            />
            Drift detected
          </label>
          <input
            type="number"
            placeholder="Min savings $"
            value={filters.minSavings}
            onChange={(e) => setFilters((f) => ({ ...f, minSavings: e.target.value }))}
            className="w-28 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-sm text-zinc-300"
          />
        </div>
      </Reveal>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      ) : (
        <Reveal direction="up" blur delay={0.15}>
          <div className="overflow-x-auto glass-card rounded-xl">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-medium text-white tracking-[-0.04em]">Lead</th>
                  <th className="px-4 py-3 text-left font-medium text-white tracking-[-0.04em]">Tier</th>
                  <th className="px-4 py-3 text-left font-medium text-white tracking-[-0.04em]">Urgency</th>
                  <th className="px-4 py-3 text-right font-medium text-white tracking-[-0.04em]">Expansion %</th>
                  <th className="px-4 py-3 text-right font-medium text-white tracking-[-0.04em]">Enterprise %</th>
                  <th className="px-4 py-3 text-right font-medium text-white tracking-[-0.04em]">Savings</th>
                  <th className="px-4 py-3 text-left font-medium text-white tracking-[-0.04em]">Drift</th>
                  <th className="px-4 py-3 text-left font-medium text-white tracking-[-0.04em]">Follow-up</th>
                  <th className="px-4 py-3 text-left font-medium text-white tracking-[-0.04em]">Tags</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                      No cloud-operator leads with deal signals. Run trigger to generate.
                    </td>
                  </tr>
                ) : (
                  leads.map((row) => (
                    <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${row.email}`}
                          className="font-medium text-violet-400 hover:underline"
                        >
                          {row.email}
                        </a>
                        {row.name && <span className="block text-xs text-zinc-500">{row.name}</span>}
                      </td>
                      <td className="px-4 py-3 capitalize text-zinc-300">{row.tier}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${urgencyColor(row.urgencyLevel)}`}>
                          {row.urgencyLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{row.expansionProbability}%</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{row.enterpriseLikelihood}%</td>
                      <td className="px-4 py-3 text-right text-zinc-300">
                        {row.estimatedSavings != null ? `$${row.estimatedSavings.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.driftDetected ? (
                          <ExclamationTriangleIcon className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {row.dealTimeline
                          ? `${row.dealTimeline.recommendedFollowUpDays}d · ${row.dealTimeline.idealEngagementModel}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.tags.slice(0, 4).map((t) => (
                            <span key={t} className="huly-badge text-[10px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}
    </div>
  );
}
