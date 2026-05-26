"use client";

/**
 * /dashboard/repositories — Phase 459.
 * Inventory of repos with provider badge, protection strength,
 * open PR count, recent tag count, last workflow status.
 */

import { useEffect, useState } from "react";
import {
  CodeBracketSquareIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface ListRow {
  id: string;
  provider: "github" | "gitlab" | "azuredevops" | "other";
  displayName: string;
  remoteUrl: string;
  defaultBranch: string;
  protectionStrength: "strong" | "weak" | "none";
  flavorBadge: string | null;
  openPrCount: number;
  recentTagCount: number;
  lastWorkflow: {
    name: string;
    state: "queued" | "in_progress" | "completed";
    conclusion: string | null;
    startedAtIso: string | null;
  } | null;
}

interface DigestData {
  generatedAt: string;
  repositories: ListRow[];
  summary: { total: number; byProvider: Record<string, number>; weakProtection: number };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const PROVIDER_LABEL: Record<ListRow["provider"], string> = {
  github: "GitHub",
  gitlab: "GitLab",
  azuredevops: "Azure DevOps",
  other: "Other",
};

const PROTECTION_CLASS: Record<ListRow["protectionStrength"], string> = {
  strong: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  weak:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  none:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

function workflowToneFor(r: ListRow): string {
  if (!r.lastWorkflow) return "bg-zinc-700/40 text-zinc-300 border-zinc-700/40";
  if (r.lastWorkflow.state !== "completed") return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  if (r.lastWorkflow.conclusion === "success") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  return "bg-rose-500/15 text-rose-300 border-rose-500/25";
}

export default function RepositoriesPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/repository-list", { credentials: "include" })
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
        kicker={`ReleaseOps · repositories${data ? ` · ${data.summary.total} tracked` : ""}`}
        title={<>Every repo. <span className="text-zinc-500">One audit lens.</span></>}
        description="Inventory of repositories the platform discovers via GitHub / GitLab / Azure DevOps adapters. Drives branch validation, release-tag diffs, evidence packs."
        helps="See which repos have weak branch protection, which have open work, and which workflows last ran."
        connectFirst="Connect a Git provider via the Connectors tab to populate this inventory."
        engineers={["DevOps", "Release Captain", "Security"]}
        requiresApproval="Configuration edits (protection settings, PR templates) belong on the provider side."
        actions={[
          { label: "Releases",       href: "/dashboard/releases" },
          { label: "Connector setup", href: "/dashboard/connector-setup" },
        ]}
        safetyNote="Read-only · per-org isolation · 18 branch-validation checks read from this inventory"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading repositories…
        </div>
      )}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={CodeBracketSquareIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
            <Stat icon={ShieldCheckIcon} label="Strong protection" value={String(data.summary.total - data.summary.weakProtection)} tone={data.summary.total - data.summary.weakProtection === data.summary.total ? "emerald" : "zinc"} />
            <Stat icon={ExclamationTriangleIcon} label="Weak / none" value={String(data.summary.weakProtection)} tone={data.summary.weakProtection > 0 ? "rose" : "zinc"} />
            <Stat icon={ChartBarIcon} label="Providers" value={String(Object.keys(data.summary.byProvider).length)} tone="zinc" />
          </div>

          {data.repositories.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No repositories tracked yet. Connect a Git provider to start populating.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.repositories.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300 border border-zinc-600/40 shrink-0">
                        {PROVIDER_LABEL[r.provider]}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">{r.displayName}</p>
                      <span className="text-[10px] font-mono text-zinc-500">default: {r.defaultBranch}</span>
                      {r.flavorBadge && (
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                          {r.flavorBadge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${PROTECTION_CLASS[r.protectionStrength]}`}>
                        {r.protectionStrength} protection
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {r.openPrCount} open PR{r.openPrCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {r.recentTagCount} tag{r.recentTagCount === 1 ? "" : "s"}
                      </span>
                      {r.lastWorkflow && (
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${workflowToneFor(r)}`}>
                          {r.lastWorkflow.state === "completed"
                            ? `${r.lastWorkflow.name} · ${r.lastWorkflow.conclusion ?? "completed"}`
                            : `${r.lastWorkflow.name} · ${r.lastWorkflow.state}`}
                        </span>
                      )}
                    </div>
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

function Stat({ icon: Icon, label, value, tone }: { icon: typeof CodeBracketSquareIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
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
