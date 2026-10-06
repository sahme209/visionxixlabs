"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface DataSourceState {
  available: boolean;
  reason?: string;
}

interface PlaybookData {
  id: string;
  risk: {
    blastRadius: string;
    affectedServiceCount: number | DataSourceState;
  };
}

const BLAST_COLORS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/25",
  critical: "bg-rose-500/10 text-rose-300 border-rose-500/25",
  unscored: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25",
};

export default function ReleaseRiskDetailPage() {
  const params = useParams();
  const releaseId = String(params.id);
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/release-playbook/${encodeURIComponent(releaseId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: PlaybookData; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Failed to load release");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Network error"))
      .finally(() => setLoading(false));
  }, [releaseId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] text-zinc-400">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
        {error || "Release not found"}
      </div>
    );
  }

  const risk = data.risk;

  return (
    <div className="relative">
      <Link
        href={`/dashboard/releases/${releaseId}/playbook`}
        className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to playbook
      </Link>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h1 className="text-[24px] font-bold text-white mb-6">Risk Assessment</h1>

        <div className="space-y-6">
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Blast Radius
            </h2>
            <div className={`rounded-xl px-4 py-3 inline-block border ${BLAST_COLORS[risk.blastRadius] || BLAST_COLORS.unscored}`}>
              <span className="text-[13px] font-semibold uppercase tracking-wider">
                {risk.blastRadius}
              </span>
            </div>
          </section>

          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Affected Services
            </h2>
            <div className={`rounded-2xl border p-4 ${
              typeof risk.affectedServiceCount === 'number'
                ? 'border-white/[0.08] bg-white/[0.025]'
                : 'border-zinc-500/[0.25] bg-zinc-500/[0.05]'
            }`}>
              {typeof risk.affectedServiceCount === 'number' ? (
                <>
                  <p className="text-[28px] font-bold text-white">{risk.affectedServiceCount}</p>
                  <p className="text-[12px] text-zinc-400 mt-1">
                    {risk.affectedServiceCount === 0
                      ? "No service impact detected"
                      : risk.affectedServiceCount === 1
                        ? "1 service will be affected"
                        : `${risk.affectedServiceCount} services will be affected`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-semibold text-zinc-300 mb-1">Preview</p>
                  <p className="text-[12px] text-zinc-400">{risk.affectedServiceCount.reason}</p>
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-cyan-500/[0.15] bg-cyan-500/[0.04] p-4">
            <p className="text-[12px] text-cyan-200">
              💡 Blast radius is calculated based on the scope of changes and number of affected services.
              {risk.blastRadius === "critical" && " Consider phased rollout or additional testing."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
