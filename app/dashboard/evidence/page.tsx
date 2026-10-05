"use client";

/**
 * /dashboard/evidence
 *
 * Operator-facing evidence inspector. Fetches /api/trust/evidence and
 * renders the canonical EvidenceRecord list — total, verified, coverage,
 * plus a filterable record table.
 *
 * Replaces a previously missing /dashboard/evidence route that doc CTAs +
 * Trust Center had been linking to.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, DocumentTextIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

interface EvidenceRecordLite {
  id: string;
  controlId?: string;
  kind: string;
  source: string;
  title: string;
  collectedAt: string;
  verified: boolean;
  selfAttested: boolean;
  manual: boolean;
  reference?: string;
  limitations?: string[];
}

interface EvidenceResponse {
  generatedAt: string;
  summary: {
    total: number;
    verified: number;
    selfAttested: number;
    manual: number;
    unverified: number;
    coverageScore: number;
  };
  records: EvidenceRecordLite[];
  limitations: string[];
}

const SOURCE_TONE: Record<string, string> = {
  prisma:        "bg-emerald-500/15 text-emerald-300",
  audit:         "bg-emerald-500/15 text-emerald-300",
  validation:    "bg-cyan-500/15 text-cyan-300",
  self_attested: "bg-amber-500/15 text-amber-300",
  manual:        "bg-amber-500/15 text-amber-300",
};

export default function EvidencePage() {
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | "verified" | "self_attested" | "manual">("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trust/evidence", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: EvidenceResponse; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setData(json.data);
        else setError(json.error?.userMessage ?? "Evidence unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const records = (data?.records ?? []).filter((r) => {
    if (kindFilter === "all") return true;
    if (kindFilter === "verified") return r.verified;
    if (kindFilter === "self_attested") return r.selfAttested;
    if (kindFilter === "manual") return r.manual;
    return true;
  });

  const coveragePct = data ? Math.round(data.summary.coverageScore * 100) : 0;

  return (
    <div className="relative">
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(16,185,129,0.08), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(99,102,241,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="grid md:grid-cols-[1fr_auto] items-end gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
                <DocumentTextIcon className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Evidence · audit-ready</span>
              </span>
              {data?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(data.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Audit-ready <span className="text-gradient">evidence.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Every evidence record Axiom has collected, classified by source. Verified evidence comes from real audit + validation runs. Self-attested + manual records are clearly labeled. <span className="text-zinc-500">No SOC 2 / ISO claims without backing records.</span>
            </p>
          </div>

          <div className="hidden md:flex items-end gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
            <Stat label="Total" value={String(data?.summary.total ?? (loading ? 0 : 0))} tone="text-white" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <Stat label="Verified" value={String(data?.summary.verified ?? 0)} tone="text-emerald-300" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <Stat label="Coverage" value={`${coveragePct}%`} tone={coveragePct >= 60 ? "text-emerald-300" : coveragePct >= 30 ? "text-amber-300" : "text-rose-300"} />
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing evidence…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// evidence unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {/* Summary breakdown */}
      {data && (
        <section className="mb-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Verified records" value={data.summary.verified} tone="emerald" detail="Backed by audit / validation runs" />
          <SummaryCard label="Self-attested" value={data.summary.selfAttested} tone="cyan" detail="Operator declarations · not auto-verified" />
          <SummaryCard label="Manual" value={data.summary.manual} tone="amber" detail="Hand-collected docs / screenshots" />
          <SummaryCard label="Unverified" value={data.summary.unverified} tone="rose" detail="Pending verification" />
        </section>
      )}

      {/* Filter + records */}
      {data && data.records.length > 0 && (
        <section className="mb-10">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// records</p>
              <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">{records.length} of {data.records.length} shown</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {(["all", "verified", "self_attested", "manual"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
                    kindFilter === k
                      ? "bg-white/[0.06] border-white/[0.18] text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white"
                  }`}
                >
                  {k.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {records.slice(0, 100).map((r) => {
                const tone = r.verified ? "emerald" : r.manual ? "amber" : r.selfAttested ? "cyan" : "zinc";
                const dot =
                  tone === "emerald" ? "bg-emerald-400" :
                  tone === "amber"   ? "bg-amber-400"   :
                  tone === "cyan"    ? "bg-cyan-400"    :
                                       "bg-zinc-500";
                const sourceClass = SOURCE_TONE[r.source] ?? "bg-zinc-700/40 text-zinc-300";
                return (
                  <div key={r.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-[13px] font-semibold text-white tracking-tight truncate">{r.title}</p>
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded ${sourceClass}`}>{r.source.replace(/_/g, " ")}</span>
                          {r.controlId && (
                            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded bg-violet-500/15 text-violet-300">{r.controlId}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {r.kind.replace(/_/g, " ")} · collected {new Date(r.collectedAt).toLocaleString()}
                        </p>
                        {r.limitations && r.limitations.length > 0 && (
                          <p className="text-[11px] text-amber-300/80 leading-snug mt-1">{r.limitations[0]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {records.length > 100 && (
              <div className="px-4 py-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Showing first 100 of {records.length} records · use /api/trust/evidence?control=X to drill down
              </div>
            )}
          </div>
        </section>
      )}

      {data && data.records.length === 0 && (
        <section className="mb-8 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">// no evidence collected yet</p>
          <p className="text-[14px] text-zinc-200 font-semibold mb-1">No records to inspect.</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            Evidence is collected when scans run, approvals are decided, validation passes, and security reviews complete. Connect at least one source to start populating the audit trail.
          </p>
          <Link href="/dashboard/sources" className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-amber-200 hover:text-amber-100 border border-amber-500/30 bg-amber-500/[0.06] rounded-md px-3 py-1.5 transition-colors">
            Open sources <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </section>
      )}

      {/* Limitations */}
      {data && data.limitations.length > 0 && (
        <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">// limitations</p>
          <ul className="space-y-1">
            {data.limitations.map((l, i) => (
              <li key={i} className="text-[12px] text-zinc-400 leading-relaxed flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Export pointer */}
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
        <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// export</p>
          <p className="text-[13px] text-emerald-100 font-semibold leading-snug mb-1">
            Need to hand evidence to an auditor? Use the Trust Center export.
          </p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            POST /api/trust/export returns a signed compliance bundle (JSON / NDJSON) with audit events, evidence records, control mappings, and traces.
          </p>
        </div>
        <Link href="/dashboard/trust" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100 border border-emerald-500/30 bg-emerald-500/[0.06] rounded-md px-3 py-1.5 transition-colors shrink-0">
          Trust Center <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="text-right min-w-[4.5rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}

function SummaryCard({ label, value, tone, detail }: { label: string; value: number; tone: "emerald" | "cyan" | "amber" | "rose"; detail: string }) {
  const toneClasses: Record<string, { border: string; bg: string; text: string }> = {
    emerald: { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300" },
    cyan:    { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300"    },
    amber:   { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300"   },
    rose:    { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300"    },
  };
  const t = toneClasses[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-4`}>
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight leading-none ${t.text} mb-1`}>{value}</p>
      <p className="text-[11px] text-zinc-400 leading-snug">{detail}</p>
    </div>
  );
}
