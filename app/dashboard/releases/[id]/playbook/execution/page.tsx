"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface PlaybookData {
  id: string;
  execution: {
    status: string;
    plannedAt: string | null;
    startedAt: string | null;
  };
}

export default function ReleaseExecutionDetailPage() {
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
      <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
        {error || "Release not found"}
      </div>
    );
  }

  const execution = data.execution;
  const statusColor = {
    not_started: "bg-zinc-500/10 text-zinc-300",
    in_progress: "bg-amber-500/10 text-amber-300",
    completed: "bg-emerald-500/10 text-emerald-300",
  }[execution.status] || "bg-zinc-500/10 text-zinc-300";

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
        <h1 className="text-[24px] font-bold text-white mb-6">Execution Status</h1>

        <div className="space-y-6">
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Current Status
            </h2>
            <div className={`rounded-xl px-4 py-3 inline-block border ${statusColor}`}>
              <span className="text-[13px] font-semibold uppercase tracking-wider">
                {execution.status.replace(/_/g, " ")}
              </span>
            </div>
          </section>

          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Timeline
            </h2>
            <dl className="space-y-3 text-[13px]">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <dt className="text-zinc-500 text-[11px] font-mono uppercase mb-1">Planned</dt>
                <dd className="text-white">
                  {execution.plannedAt ? new Date(execution.plannedAt).toLocaleString() : "Not scheduled"}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <dt className="text-zinc-500 text-[11px] font-mono uppercase mb-1">Started</dt>
                <dd className="text-white">
                  {execution.startedAt ? new Date(execution.startedAt).toLocaleString() : "Not started"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
