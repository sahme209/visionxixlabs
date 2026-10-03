"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface PlaybookData {
  id: string;
  closure: {
    status: string;
    closedAt: string | null;
  };
}

export default function ReleaseClosureDetailPage() {
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

  const closure = data.closure;
  const isClosed = closure.status === "closed";

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
        <h1 className="text-[24px] font-bold text-white mb-6">Release Closure</h1>

        <div className="space-y-6">
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-4">
              Status
            </h2>
            <div
              className={`rounded-2xl border p-5 ${
                isClosed
                  ? "border-emerald-500/[0.25] bg-emerald-500/[0.04]"
                  : "border-zinc-500/[0.25] bg-zinc-500/[0.04]"
              }`}
            >
              <p className={`text-[14px] font-semibold uppercase tracking-wider ${
                isClosed ? "text-emerald-300" : "text-zinc-300"
              }`}>
                {isClosed ? "✓ Closed" : "Open"}
              </p>
              {closure.closedAt && (
                <p className="text-[12px] text-zinc-400 mt-2">
                  Closed at {new Date(closure.closedAt).toLocaleString()}
                </p>
              )}
            </div>
          </section>

          {isClosed ? (
            <div className="rounded-2xl border border-emerald-500/[0.15] bg-emerald-500/[0.04] p-4">
              <p className="text-[12px] text-emerald-200">
                ✓ This release has been completed and closed. All stages are finished.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-cyan-500/[0.15] bg-cyan-500/[0.04] p-4">
              <p className="text-[12px] text-cyan-200">
                💡 This release is still in progress. It will be marked as closed once all stages
                (execution, validation, evidence) are complete.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
