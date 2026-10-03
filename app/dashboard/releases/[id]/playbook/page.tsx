"use client";

/**
 * /dashboard/releases/[id]/playbook — Phase TBD.
 *
 * Unified release playbook with progressive disclosure:
 * - Tab 1: WHAT IS HAPPENING? (glanceable status of all 9 stages)
 * - Tab 2: WHAT NEEDS ATTENTION? (critical items only)
 * - Tab 3: WHAT CHANGED? (revision history + audit trail)
 *
 * Makes the Playbook the center: Request → Readiness → Playbook → Risk →
 * Approval → Execution → Validation → Evidence → Closure.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface PlaybookData {
  id: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;
  lifecycle: Record<string, string | null>;
  request: Record<string, unknown>;
  readiness: Record<string, unknown>;
  playbook: Record<string, unknown>;
  risk: Record<string, unknown>;
  approval: Record<string, unknown>;
  execution: Record<string, unknown>;
  validation: Record<string, unknown>;
  evidence: Record<string, unknown>;
  closure: Record<string, unknown>;
  auditEventCount: number;
  lastUpdated: string;
}

type Tab = "what" | "attention" | "changed";

export default function UnifiedPlaybookPage() {
  const params = useParams();
  const releaseId = String(params.id);
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("what");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/release-playbook/${encodeURIComponent(releaseId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: PlaybookData; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Failed to load playbook");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Network error"))
      .finally(() => setLoading(false));
  }, [releaseId]);

  return (
    <div className="relative">
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <Link href="/dashboard/releases" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          All releases
        </Link>
      </div>

      {/* Header */}
      {data && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <h1 className="text-[24px] font-bold text-white">
              {data.releaseTag ?? "(Untagged Release)"}
            </h1>
            <span className="text-[11px] font-mono uppercase px-2 py-1 rounded bg-white/5 border border-white/[0.08] text-zinc-300">
              {data.status}
            </span>
          </div>
          {data.commitSha && (
            <p className="text-[11px] font-mono text-zinc-500">
              sha {data.commitSha.slice(0, 12)}…
            </p>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
        <button
          onClick={() => setTab("what")}
          className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition ${
            tab === "what"
              ? "border-violet-400 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          What is happening?
        </button>
        <button
          onClick={() => setTab("attention")}
          className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition ${
            tab === "attention"
              ? "border-violet-400 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          What needs attention?
        </button>
        <button
          onClick={() => setTab("changed")}
          className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition ${
            tab === "changed"
              ? "border-violet-400 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          What changed?
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] text-zinc-400">
          Loading playbook…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {data && !loading && !error && (
        <>
          {tab === "what" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">
                All 9 stages of your release journey. Click any stage to expand details.
              </p>
              {/* TODO: Render 9 stage cards with status indicators */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-[12px] text-zinc-400">
                Stage cards coming soon (9 stages: Request, Readiness, Playbook, Risk, Approval, Execution, Validation, Evidence, Closure)
              </div>
            </div>
          )}

          {tab === "attention" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">
                Only items that need action. Everything else is green.
              </p>
              {/* TODO: Render blockers, pending approvals, deadline warnings */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-[12px] text-zinc-400">
                No blockers or pending items at the moment.
              </div>
            </div>
          )}

          {tab === "changed" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">
                Release revisions and audit trail ({data.auditEventCount} events).
              </p>
              {/* TODO: Render revision timeline + audit log */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-[12px] text-zinc-400">
                Revision history and audit trail coming soon.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
