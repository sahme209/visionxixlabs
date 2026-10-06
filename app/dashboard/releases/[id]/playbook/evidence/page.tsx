"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon, LockClosedIcon } from "@heroicons/react/24/outline";

interface PlaybookData {
  id: string;
  evidence: {
    generatedAt: string | null;
    signedAt: string | null;
  };
}

export default function ReleaseEvidenceDetailPage() {
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

  const evidence = data.evidence;

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
        <h1 className="text-[24px] font-bold text-white mb-6">Evidence Pack</h1>

        <div className="space-y-6">
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-4">
              Pack Status
            </h2>
            <div className="space-y-3">
              <div
                className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  evidence.generatedAt
                    ? "border-emerald-500/[0.25] bg-emerald-500/[0.04]"
                    : "border-zinc-500/[0.25] bg-zinc-500/[0.04]"
                }`}
              >
                <CheckCircleIcon
                  className={`h-5 w-5 mt-0.5 shrink-0 ${
                    evidence.generatedAt ? "text-emerald-400" : "text-zinc-500"
                  }`}
                />
                <div>
                  <p className="text-[12px] font-semibold text-white">
                    {evidence.generatedAt ? "Generated" : "Awaiting Generation"}
                  </p>
                  {evidence.generatedAt && (
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {new Date(evidence.generatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  evidence.signedAt
                    ? "border-emerald-500/[0.25] bg-emerald-500/[0.04]"
                    : "border-amber-500/[0.25] bg-amber-500/[0.04]"
                }`}
              >
                <LockClosedIcon
                  className={`h-5 w-5 mt-0.5 shrink-0 ${
                    evidence.signedAt ? "text-emerald-400" : "text-amber-400"
                  }`}
                />
                <div>
                  <p className="text-[12px] font-semibold text-white">
                    {evidence.signedAt ? "Cryptographically Signed" : "Awaiting Signature"}
                  </p>
                  {evidence.signedAt ? (
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {new Date(evidence.signedAt).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-300 mt-1">
                      Pending authorization to sign
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {!evidence.generatedAt && (
            <div className="rounded-2xl border border-cyan-500/[0.15] bg-cyan-500/[0.04] p-4">
              <p className="text-[12px] text-cyan-200">
                💡 Evidence packs are generated after successful execution to document what was deployed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
