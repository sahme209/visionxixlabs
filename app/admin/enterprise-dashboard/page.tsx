"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FunnelIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

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
    if (u === "critical") return "bg-rose-500/10 text-rose-300";
    if (u === "high") return "bg-amber-500/10 text-amber-300";
    if (u === "medium") return "bg-sky-500/10 text-sky-300";
    return "bg-zinc-700 text-zinc-300";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Sales Intelligence
          </h1>
          <p className="text-zinc-400 mt-1">
            Cloud Operator leads with deal signals. Internal CRM-lite.
          </p>
        </div>
        <Link
          href="/admin/leads"
          className="text-sm text-violet-400 hover:underline"
        >
          Website Leads →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 p-4 rounded-xl bg-white/[0.04]/50">
        <span className="text-xs font-medium text-zinc-500 flex items-center gap-1">
          <FunnelIcon className="h-4 w-4" /> Filters
        </span>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.highUrgency}
            onChange={(e) => setFilters((f) => ({ ...f, highUrgency: e.target.checked }))}
            className="rounded border-white/[0.08]"
          />
          High urgency
        </label>
        <select
          value={filters.tier}
          onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value }))}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-sm"
        >
          <option value="">All tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="growth">Growth</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.driftDetected}
            onChange={(e) => setFilters((f) => ({ ...f, driftDetected: e.target.checked }))}
            className="rounded border-white/[0.08]"
          />
          Drift detected
        </label>
        <input
          type="number"
          placeholder="Min savings $"
          value={filters.minSavings}
          onChange={(e) => setFilters((f) => ({ ...f, minSavings: e.target.value }))}
          className="w-28 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left font-medium text-white">Lead</th>
                <th className="px-4 py-3 text-left font-medium text-white">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-white">Urgency</th>
                <th className="px-4 py-3 text-right font-medium text-white">Expansion %</th>
                <th className="px-4 py-3 text-right font-medium text-white">Enterprise %</th>
                <th className="px-4 py-3 text-right font-medium text-white">Savings</th>
                <th className="px-4 py-3 text-left font-medium text-white">Drift</th>
                <th className="px-4 py-3 text-left font-medium text-white">Follow-up</th>
                <th className="px-4 py-3 text-left font-medium text-white">Tags</th>
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
                  <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.04]/50">
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${row.email}`}
                        className="font-medium text-violet-400 hover:underline"
                      >
                        {row.email}
                      </a>
                      {row.name && <span className="block text-xs text-slate-500">{row.name}</span>}
                    </td>
                    <td className="px-4 py-3 capitalize">{row.tier}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${urgencyColor(row.urgencyLevel)}`}>
                        {row.urgencyLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{row.expansionProbability}%</td>
                    <td className="px-4 py-3 text-right">{row.enterpriseLikelihood}%</td>
                    <td className="px-4 py-3 text-right">
                      {row.estimatedSavings != null ? `$${row.estimatedSavings.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.driftDetected ? (
                        <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.dealTimeline
                        ? `${row.dealTimeline.recommendedFollowUpDays}d · ${row.dealTimeline.idealEngagementModel}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.tags.slice(0, 4).map((t) => (
                          <span key={t} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
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
      )}
    </div>
  );
}
