"use client";

/**
 * /dashboard/releases — Phase 447.
 *
 * Lists recent releases with status, readiness summary, and evidence
 * indicators. Pure-presentational; reads from
 * /api/dashboard/release-list. Detail page lands in a future phase.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RocketLaunchIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type SidebarTone = "emerald" | "amber" | "rose" | "blue" | "zinc";
type RiskBadge = "low" | "medium" | "high" | "critical" | "unscored";

interface ReleaseListRow {
  id: string;
  applicationId: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;
  statusLabel: string;
  sidebarTone: SidebarTone;
  targetEnvironmentId: string | null;
  createdAt: string;
  scopeFinalizedAt: string | null;
  latestReadiness: {
    overallScore: number;
    riskLevel: RiskBadge;
    blockerCount: number;
    evaluatedAtIso: string;
    evaluationSource: string;
  } | null;
  evidencePack: { generatedAtIso: string; signed: boolean } | null;
}

interface DigestData {
  generatedAt: string;
  releases: ReleaseListRow[];
  summary: {
    total: number;
    draft: number; ready: number; deploying: number;
    deployed: number; rolled_back: number; failed: number;
    withEvidence: number; signedEvidence: number;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const DOT_CLASS: Record<SidebarTone, string> = {
  emerald: "bg-emerald-400",
  amber:   "bg-amber-400",
  rose:    "bg-rose-400",
  blue:    "bg-blue-400",
  zinc:    "bg-zinc-600",
};

const RISK_CLASS: Record<RiskBadge, string> = {
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  unscored: "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

function ageStr(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ReleasesPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/release-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;
  const now = new Date();

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · releases${data ? ` · ${data.summary.total} tracked` : ""}`}
        title={<>Every release. <span className="text-zinc-500">One canonical audit.</span></>}
        description="Per-release status, readiness score, evidence pack, and signed-state. Drives the dashboard sidebar dot and the on-call routing for sticky errors."
        helps="See which releases are deploying, which need attention, and which evidence packs are still unsigned."
        connectFirst="Already wired via the Phase 442 lifecycle + Phase 444 readiness persistence."
        engineers={["Release Captain", "DevOps", "Compliance"]}
        requiresApproval="Scope changes after readiness approval, exception waivers, and emergency-change deploys."
        actions={[
          { label: "ReleaseOps command center", href: "/dashboard/releaseops" },
          { label: "Connector setup",            href: "/dashboard/connector-setup" },
        ]}
        safetyNote="Click any release → full overview · every transition audited"
      />

      <SubsystemNav />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading releases…
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
          <p className="text-[12.5px] text-zinc-300 leading-relaxed">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required to view releases.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={RocketLaunchIcon} label="Total"      value={String(data.summary.total)} tone="zinc" />
            <Stat icon={ClockIcon}        label="Ready"      value={String(data.summary.ready)} tone={data.summary.ready > 0 ? "amber" : "zinc"} />
            <Stat icon={CheckCircleIcon}  label="Deployed"   value={String(data.summary.deployed)} tone="emerald" />
            <Stat icon={ShieldCheckIcon}  label="Signed evidence" value={`${data.summary.signedEvidence}/${data.summary.withEvidence || 0}`} tone={data.summary.signedEvidence === data.summary.withEvidence && data.summary.withEvidence > 0 ? "emerald" : "zinc"} />
          </div>

          {data.releases.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No releases yet. The Phase 442 pipeline creates draft releases as deploys are initiated.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.releases.map((r) => (
                <ReleaseRow key={r.id} r={r} now={now} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReleaseRow({ r, now }: { r: ReleaseListRow; now: Date }) {
  return (
    <Link
      href={`/dashboard/releases/${r.id}`}
      className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/[0.30] hover:bg-white/[0.03] transition-all"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[r.sidebarTone]}`} />
          <p className="text-[13px] font-semibold text-white truncate">
            {r.releaseTag ?? "(no tag)"} <span className="text-zinc-500 font-normal">· {r.applicationId}</span>
          </p>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08] shrink-0">
            {r.statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {r.latestReadiness && (
            <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${RISK_CLASS[r.latestReadiness.riskLevel]}`}>
              {r.latestReadiness.overallScore}/100 · {r.latestReadiness.riskLevel}
            </span>
          )}
          {r.latestReadiness && r.latestReadiness.blockerCount > 0 && (
            <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25">
              {r.latestReadiness.blockerCount} blocker{r.latestReadiness.blockerCount === 1 ? "" : "s"}
            </span>
          )}
          {r.evidencePack && (
            <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${r.evidencePack.signed ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-amber-500/10 text-amber-300 border-amber-500/20"}`}>
              evidence {r.evidencePack.signed ? "signed" : "draft"}
            </span>
          )}
          <span className="text-[10px] font-mono text-violet-300/70">overview →</span>
        </div>
      </div>
      {r.commitSha && (
        <p className="mt-2 text-[11.5px] font-mono text-zinc-500">
          commit {r.commitSha.slice(0, 12)} · created {ageStr(r.createdAt, now)}
        </p>
      )}
    </Link>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof RocketLaunchIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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

/* ──────────────────────────────────────────────────────────────────
   Phase 489 — subsystem nav. Quick deep-links to the ReleaseOps
   surfaces from the releases list, so operators don't bounce back
   to the sidebar to navigate between Cherry-picks, Drift, Readiness,
   etc.
   ────────────────────────────────────────────────────────────── */

const SUBSYSTEMS: Array<{ label: string; href: string; tone: string }> = [
  { label: "Repositories",         href: "/dashboard/repositories",     tone: "border-violet-500/30 text-violet-200" },
  { label: "Cherry-picks",         href: "/dashboard/cherry-picks",     tone: "border-violet-500/30 text-violet-200" },
  { label: "Change tickets",       href: "/dashboard/change-tickets",   tone: "border-violet-500/30 text-violet-200" },
  { label: "Release freeze",       href: "/dashboard/release-freeze",   tone: "border-cyan-500/30 text-cyan-200" },
  { label: "Release readiness",    href: "/dashboard/release-readiness", tone: "border-emerald-500/30 text-emerald-200" },
  { label: "Policy violations",    href: "/dashboard/policy-violations", tone: "border-rose-500/30 text-rose-200" },
  { label: "Drift",                href: "/dashboard/drift",            tone: "border-amber-500/30 text-amber-200" },
  { label: "SOPs",                 href: "/dashboard/sops",             tone: "border-zinc-500/30 text-zinc-200" },
];

function SubsystemNav() {
  return (
    <div className="mb-6 flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-1">Subsystems</span>
      {SUBSYSTEMS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={`px-2.5 py-1 rounded-lg border bg-white/[0.02] hover:bg-white/[0.06] transition-colors ${s.tone}`}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
