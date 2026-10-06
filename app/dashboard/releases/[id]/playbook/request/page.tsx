"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface PlaybookData {
  id: string;
  releaseTag: string | null;
  request: {
    summary: string | null;
    owner: string | null;
    targetEnvironment: string | null;
    plannedWindowStart: string | null;
    plannedWindowEnd: string | null;
  };
  lifecycle: {
    requestedAt: string;
    requestedBy: string | null;
  };
}

export default function ReleaseRequestDetailPage() {
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
        <h1 className="text-[24px] font-bold text-white mb-6">Request Details</h1>

        <div className="space-y-5">
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Release Information
            </h2>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Release Tag</dt>
                <dd className="text-white font-mono">{data.releaseTag || "(no tag)"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Requested At</dt>
                <dd className="text-white">{new Date(data.lifecycle.requestedAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Requested By</dt>
                <dd className="text-white font-mono">{data.lifecycle.requestedBy || "(system)"}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Deployment Scope
            </h2>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Target Environment</dt>
                <dd className="text-white">{data.request.targetEnvironment || "(not set)"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Owner</dt>
                <dd className="text-white">{data.request.owner || "(not assigned)"}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Planned Deployment Window
            </h2>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Start</dt>
                <dd className="text-white">
                  {data.request.plannedWindowStart
                    ? new Date(data.request.plannedWindowStart).toLocaleString()
                    : "(no window set)"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">End</dt>
                <dd className="text-white">
                  {data.request.plannedWindowEnd
                    ? new Date(data.request.plannedWindowEnd).toLocaleString()
                    : "(no window set)"}
                </dd>
              </div>
            </dl>
          </section>

          {data.request.summary && (
            <section>
              <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
                Summary
              </h2>
              <p className="text-[13px] text-white leading-relaxed">{data.request.summary}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
