"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface PlaybookData {
  id: string;
  releaseTag: string | null;
  playbook: {
    stepCount: number;
    cherryPickCount: number;
    policyViolationCount: number;
  };
}

export default function ReleasePlaybookStageDetailPage() {
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

  const playbook = data.playbook;

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
        <h1 className="text-[24px] font-bold text-white mb-6">Playbook Details</h1>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
              Deployment Steps
            </p>
            <p className="text-[28px] font-bold text-white">{playbook.stepCount}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
              Cherry-Picks
            </p>
            <p className="text-[28px] font-bold text-amber-300">{playbook.cherryPickCount}</p>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              playbook.policyViolationCount > 0
                ? "border-rose-500/[0.25] bg-rose-500/[0.04]"
                : "border-white/[0.08] bg-white/[0.025]"
            }`}
          >
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
              Policy Violations
            </p>
            <p
              className={`text-[28px] font-bold ${
                playbook.policyViolationCount > 0 ? "text-rose-300" : "text-white"
              }`}
            >
              {playbook.policyViolationCount}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {playbook.cherryPickCount > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.15] bg-amber-500/[0.04] p-4">
              <p className="text-[12px] text-amber-200">
                ⚠️ This release includes {playbook.cherryPickCount} cherry-pick{playbook.cherryPickCount !== 1 ? "s" : ""}.
                Verify each change is approved before proceeding.
              </p>
            </div>
          )}

          {playbook.policyViolationCount > 0 && (
            <div className="rounded-2xl border border-rose-500/[0.15] bg-rose-500/[0.04] p-4">
              <p className="text-[12px] text-rose-200">
                🔴 This playbook contains {playbook.policyViolationCount} policy violation
                {playbook.policyViolationCount !== 1 ? "s" : ""}. Must be resolved before deployment.
              </p>
            </div>
          )}

          {playbook.policyViolationCount === 0 && playbook.cherryPickCount === 0 && (
            <div className="rounded-2xl border border-emerald-500/[0.15] bg-emerald-500/[0.04] p-4">
              <p className="text-[12px] text-emerald-200">
                ✓ Playbook is clean — no violations or cherry-picks.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
