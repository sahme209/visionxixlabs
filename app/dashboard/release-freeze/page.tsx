"use client";

/**
 * /dashboard/release-freeze — Phase 462.
 * Per-release freeze classification (Phase 458 closed-union).
 */

import { useEffect, useState } from "react";
import {
  LockClosedIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Status = "not_yet_finalized" | "frozen" | "deploy_window_started";

interface Row {
  releaseId: string;
  applicationId: string;
  releaseTag: string | null;
  status: Status;
  hoursSinceScopeFinalized: number | null;
  scopeFinalizedAtIso: string | null;
  scopeFinalizedByUserId: string | null;
  plannedWindowStartIso: string | null;
  plannedWindowEndIso: string | null;
  actualDeployStartIso: string | null;
  actualDeployEndIso: string | null;
  summary: string;
}

interface DigestData {
  generatedAt: string;
  releases: Row[];
  summary: { total: number; byStatus: Record<Status, number> };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  not_yet_finalized:    "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
  frozen:               "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  deploy_window_started: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

const STATUS_LABEL: Record<Status, string> = {
  not_yet_finalized:    "Draft",
  frozen:               "Frozen",
  deploy_window_started: "Deploying",
};

export default function ReleaseFreezePage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/release-freeze-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · freeze board${data ? ` · ${data.summary.total} releases` : ""}`}
        title={<>Scope. <span className="text-zinc-500">Locked or live.</span></>}
        description="Every release sits in one of three buckets: draft (scope still mutable), frozen (scope locked, deploy pending), or deploying (deploy window opened). Late merges show on the per-release detail page."
        helps="At-a-glance picture of which releases are ready to ship and which still need scope sign-off."
        connectFirst="Releases populate from the per-app release pipeline. Connect Git + CI/CD to see them."
        engineers={["Release Captain", "On-call"]}
        requiresApproval="Freezing a release requires scope-finalization sign-off (Phase 458)."
        actions={[
          { label: "Releases",      href: "/dashboard/releases" },
          { label: "Cherry-picks",  href: "/dashboard/cherry-picks" },
        ]}
        safetyNote="Read-only · per-org isolation · day-of PR detection runs on per-release detail"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading freeze board…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat icon={PencilSquareIcon} label="Draft (scope mutable)" value={String(data.summary.byStatus.not_yet_finalized)} tone="zinc" />
            <Stat icon={LockClosedIcon}   label="Frozen"                value={String(data.summary.byStatus.frozen)}             tone={data.summary.byStatus.frozen > 0 ? "violet" : "zinc"} />
            <Stat icon={PlayCircleIcon}   label="Deploying"             value={String(data.summary.byStatus.deploy_window_started)} tone={data.summary.byStatus.deploy_window_started > 0 ? "emerald" : "zinc"} />
          </div>

          {data.releases.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No releases on file.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.releases.map((r) => (
                <div key={r.releaseId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">
                        {r.releaseTag ?? "(untagged)"}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-500">{r.applicationId}</span>
                    </div>
                    {r.hoursSinceScopeFinalized !== null && (
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08] shrink-0">
                        {r.hoursSinceScopeFinalized}h since freeze
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-400 mb-1.5">{r.summary}</p>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 flex-wrap">
                    {r.scopeFinalizedByUserId && (
                      <span>frozen by {r.scopeFinalizedByUserId}</span>
                    )}
                    {r.plannedWindowStartIso && (
                      <span>· planned {new Date(r.plannedWindowStartIso).toLocaleString()}</span>
                    )}
                    {r.actualDeployStartIso && (
                      <span>· deploy started {new Date(r.actualDeployStartIso).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof LockClosedIcon; label: string; value: string; tone: "violet" | "emerald" | "rose" | "zinc" }) {
  const cls = {
    violet:  "border-white/[0.06] bg-white/[0.015] text-white",
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
