"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { ClockIcon, ArrowPathIcon, DocumentTextIcon, MagnifyingGlassIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import {
  currentProcessingTimesService,
  ProcessingTimesData,
} from "@/lib/services/currentProcessingTimesService";
import USCISDisclaimer from "@/components/USCISDisclaimer";
import { parseProcessingTimes, ProcessingTimeEntry } from "@/components/CurrentProcessingTimesCard";

/** Parse USCIS date string (e.g. "December 15, 2024", "Dec 15, 2024") to days of backlog */
function parseDateToBacklogDays(dateStr: string): number | null {
  const d = new Date(dateStr.trim());
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

const POPULAR_FORMS = ["I-130", "I-485", "N-400", "I-765", "I-129F", "I-751"];

export default function ProcessingTimesPage() {
  const [data, setData] = useState<ProcessingTimesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  useEffect(() => {
    const svc = currentProcessingTimesService;
    const unsub = svc.subscribe((d) => {
      setData(d);
      setLoading(false);
    });
    return unsub;
  }, []);

  const entries: ProcessingTimeEntry[] = data?.bodyText
    ? parseProcessingTimes(data.bodyText)
    : [];

  const filtered = useMemo(() => {
    let list = entries;
    if (quickFilter) {
      list = list.filter((e) => e.formName.toUpperCase().includes(quickFilter));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => e.formName.toLowerCase().includes(q));
    }
    return list;
  }, [entries, search, quickFilter]);

  const relatedTools = [
    { title: "Fee Calculator", href: "/fees", desc: "Estimate filing fees" },
    { title: "Status Decoder", href: "/status-decoder", desc: "Understand your status" },
    { title: "Official Links", href: "/official-links", desc: "Visa bulletin, CEAC, NVC" },
    { title: "Embassy Finder", href: "/embassy", desc: "Locate consulates" },
    { title: "All Resources", href: "/resources", desc: "Browse all tools" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0">
        {/* Summary stats strip */}
        {!loading && entries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 text-[var(--text-primary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{entries.length}</p>
                <p className="text-xs text-[var(--text-tertiary)]">Forms tracked</p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-600 text-lg">●</span>
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">Live</p>
                <p className="text-xs text-[var(--text-tertiary)]">USCIS data</p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <ClockIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {data?.updatedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? "—"}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">Last update</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--uscis-blue)]/20 bg-[var(--uscis-blue)]/5 p-4 mb-6">
          <p className="text-sm text-[var(--text-primary)]">
            <strong>Tip:</strong> Processing times show the date of cases USCIS is working on. An older date means more backlog. Use our <Link href="/status-decoder" className="text-[var(--text-primary)] hover:underline">Status Decoder</Link> to understand your case status, or check the <Link href="/fees" className="text-[var(--text-primary)] hover:underline">Fee Calculator</Link> to estimate costs.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-md overflow-hidden">
          {entries.length > 0 && (
            <div className="px-5 sm:px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 space-y-4">
              {/* Quick filter chips */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setQuickFilter(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    !quickFilter
                      ? "bg-[var(--uscis-blue)] text-white"
                      : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/40"
                  }`}
                >
                  All forms
                </button>
                {POPULAR_FORMS.map((form) => (
                  <button
                    key={form}
                    onClick={() => setQuickFilter(quickFilter === form ? null : form)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      quickFilter === form
                        ? "bg-[var(--uscis-blue)] text-white"
                        : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/40"
                    }`}
                  >
                    {form}
                  </button>
                ))}
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="search"
                  aria-label="Search processing times by form"
                  placeholder="Search by form (e.g. I-130, N-400)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-[var(--uscis-blue)]/20" />
                  <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-t-[var(--uscis-blue)] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading processing times…</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Fetching latest data</p>
              </div>
            ) : filtered.length > 0 ? (
              <div className="space-y-6">
                {filtered.map((entry, idx) => (
                  <FormCard key={idx} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="text-center py-14">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--uscis-blue)]/10 flex items-center justify-center">
                  <DocumentTextIcon className="w-8 h-8 text-[var(--text-primary)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  {search || quickFilter ? "No forms match your search" : "No data available"}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {search || quickFilter
                    ? "Try a different form or clear filters"
                    : "Check back soon or use the official site for the latest dates."}
                </p>
                <a
                  href="https://egov.uscis.gov/processing-times/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--uscis-blue)] text-white text-sm font-medium hover:bg-[var(--uscis-blue-dark)] hover:shadow-lg hover:shadow-[var(--uscis-blue)]/25 transition-all duration-200"
                >
                  View official processing times
                  <ArrowPathIcon className="w-4 h-4" />
                </a>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
              <USCISDisclaimer variant="compact" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {relatedTools.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[var(--text-primary)] text-sm font-bold">{t.title.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-[var(--text-primary)] text-sm">{t.title}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            ← All Resources
          </Link>
          <Link href="/fees" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Fee Calculator
          </Link>
          <Link href="/status-decoder" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Status Decoder
          </Link>
          <Link href="/guides" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Form Guides
          </Link>
        </div>
      </main>
    </div>
  );
}

const BAR_COLORS = [
  "hsl(217, 91%, 60%)", // blue
  "hsl(142, 71%, 45%)", // green
  "hsl(25, 95%, 53%)",  // orange (Apple-style)
  "hsl(262, 83%, 58%)", // purple
  "hsl(0, 72%, 51%)",   // red
  "hsl(199, 89%, 48%)", // cyan
];

function FormCard({ entry }: { entry: ProcessingTimeEntry }) {
  const hasCharts = entry.serviceCenters.length > 0;
  const chartData = entry.serviceCenters.map((sc, i) => {
    const backlog = parseDateToBacklogDays(sc.date);
    return {
      name: sc.center,
      value: backlog != null && backlog >= 0 ? backlog : 0,
      date: sc.date,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    };
  });
  const hasValidChartData = chartData.some((d) => d.value > 0);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-gradient-to-br from-[var(--bg-surface-alt)]/50 to-[var(--bg-surface)] p-5 hover:shadow-lg hover:border-[var(--uscis-blue)]/20 transition-all overflow-hidden">
      <h4 className="mb-4 text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--uscis-blue)]" />
        {entry.formName}
      </h4>

      {hasCharts ? (
        <div className="space-y-4">
          {/* Horizontal bar chart - only show when we have parseable dates */}
          {hasValidChartData && (
          <div className="h-[180px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              >
                <XAxis type="number" hide domain={[0, "auto"]} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} stroke="var(--text-tertiary)" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold text-[var(--text-primary)]">{p.name}</p>
                        <p className="text-[var(--text-secondary)]">Processing: {p.date}</p>
                        {p.value > 0 && (
                          <p className="text-[var(--text-tertiary)] text-xs">~{p.value} days of backlog</p>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}

          {/* Legend / date pills */}
          <div className="flex flex-wrap gap-2">
            {entry.serviceCenters.map((sc, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] px-3 py-2 text-xs"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                />
                <span className="font-semibold text-[var(--text-primary)]">{sc.center}:</span>
                <span className="text-[var(--text-secondary)]">{sc.date}</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{entry.formName}</p>
      )}
    </div>
  );
}
