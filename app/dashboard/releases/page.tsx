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
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";

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

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/release-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

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

      <OnboardingChecklist />
      <HealthSummaryTile />
      <SubsystemNav />
      <NewReleasePanel onCreated={loadList} />

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
      className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all"
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
  { label: "Repositories",         href: "/dashboard/repositories",     tone: "border-white/[0.12] text-white" },
  { label: "Cherry-picks",         href: "/dashboard/cherry-picks",     tone: "border-white/[0.12] text-white" },
  { label: "Change tickets",       href: "/dashboard/change-tickets",   tone: "border-white/[0.12] text-white" },
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

/* ──────────────────────────────────────────────────────────────────
   Phase 490 — Platform health summary tile.
   ────────────────────────────────────────────────────────────── */

interface HealthSummaryData {
  generatedAt: string;
  releases: { total: number; draft: number; ready: number; deploying: number; deployed: number };
  policy: { blockingOpen: number };
  drift: { criticalOpen: number };
  cherryPicks: { requested: number };
  changeTickets: { inFlight: number };
  readiness: { evaluated: number; averageScore: number | null };
  platformHealthScore: number;
}

type HealthRespBody = { ok: true; data: HealthSummaryData } | { ok: false; error: string; hint?: string };

function HealthSummaryTile() {
  const [resp, setResp] = useState<HealthRespBody | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/releaseops-health", { credentials: "include" })
      .then((r) => r.json())
      .then((j: HealthRespBody) => { if (!cancelled) setResp(j); })
      .catch(() => { /* surface is optional */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-[12px] text-zinc-500">
        Loading platform health…
      </div>
    );
  }
  if (!resp?.ok) return null;

  const d = resp.data;
  const scoreColor =
    d.platformHealthScore >= 80 ? "text-emerald-300" :
    d.platformHealthScore >= 60 ? "text-amber-300" :
    d.platformHealthScore >= 40 ? "text-orange-300" : "text-rose-300";

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.04] via-white/[0.02] to-cyan-500/[0.04] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Platform health</p>
          <p className="text-[28px] font-bold text-white">
            <span className={scoreColor}>{d.platformHealthScore}</span>
            <span className="text-[14px] text-zinc-500">/100</span>
          </p>
        </div>
        <p className="text-[10px] font-mono text-zinc-500">
          {d.readiness.evaluated} releases scored · avg {d.readiness.averageScore ?? "—"}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px] font-mono">
        <SummaryStat label="Blocking violations" value={d.policy.blockingOpen} highlight={d.policy.blockingOpen > 0 ? "rose" : "zinc"} href="/dashboard/policy-violations" />
        <SummaryStat label="Critical drift"      value={d.drift.criticalOpen}   highlight={d.drift.criticalOpen > 0 ? "rose" : "zinc"} href="/dashboard/drift" />
        <SummaryStat label="Cherry-pick reqs"    value={d.cherryPicks.requested} highlight={d.cherryPicks.requested > 0 ? "amber" : "zinc"} href="/dashboard/cherry-picks" />
        <SummaryStat label="Tickets in flight"   value={d.changeTickets.inFlight} highlight="zinc" href="/dashboard/change-tickets" />
        <SummaryStat label="Releases deploying"  value={d.releases.deploying}    highlight={d.releases.deploying > 0 ? "emerald" : "zinc"} href="/dashboard/release-freeze" />
      </div>
    </div>
  );
}

function SummaryStat({
  label, value, highlight, href,
}: {
  label: string; value: number; highlight: "emerald" | "amber" | "rose" | "zinc"; href: string;
}) {
  const tone = {
    emerald: "text-emerald-300",
    amber:   "text-amber-300",
    rose:    "text-rose-300",
    zinc:    "text-zinc-300",
  }[highlight];
  return (
    <Link href={href} className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/[0.12] transition-colors">
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className={`text-[20px] font-bold ${tone}`}>{value}</p>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Phase 498 — release-tag creation panel.
   ────────────────────────────────────────────────────────────── */

interface ApplicationOption {
  id: string;
  name: string;
  slug: string;
}

type NewReleaseState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; releaseTag: string; created: boolean }
  | { kind: "error"; message: string };

function NewReleasePanel({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<NewReleaseState>({ kind: "closed" });
  const [apps, setApps] = useState<ApplicationOption[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [releaseTag, setReleaseTag] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (state.kind !== "open" && state.kind !== "submitting") return;
    if (apps.length > 0 || appsLoading) return;
    setAppsLoading(true);
    fetch("/api/dashboard/application-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.data.applications)) {
          setApps(j.data.applications.map((a: { id: string; name: string; slug: string }) => ({ id: a.id, name: a.name, slug: a.slug })));
          if (j.data.applications[0] && !applicationId) setApplicationId(j.data.applications[0].id);
        }
      })
      .finally(() => setAppsLoading(false));
  }, [state.kind, apps.length, appsLoading, applicationId]);

  function reset() {
    setApplicationId(""); setReleaseTag(""); setCommitSha(""); setWindowStart(""); setWindowEnd(""); setSummary("");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const body: Record<string, unknown> = { applicationId, releaseTag };
      if (commitSha) body.commitSha = commitSha;
      if (windowStart) body.plannedWindowStartIso = new Date(windowStart).toISOString();
      if (windowEnd) body.plannedWindowEndIso = new Date(windowEnd).toISOString();
      if (summary) body.summary = summary;

      const res = await fetch("/api/dashboard/release-create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", releaseTag: j.data.releaseTag, created: j.data.created });
        onCreated();
        setTimeout(reset, 1500);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  if (state.kind === "closed") {
    return (
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.025] text-[12px] font-semibold text-white hover:bg-violet-500/[0.12] transition-colors"
        >
          + New release
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">New release</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Application</span>
          <select
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            disabled={busy || appsLoading}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 disabled:opacity-50"
          >
            {appsLoading ? (
              <option value="">loading…</option>
            ) : apps.length === 0 ? (
              <option value="">no applications registered</option>
            ) : (
              apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)
            )}
          </select>
        </label>
        <ReleaseField label="Release tag (required)" value={releaseTag} onChange={setReleaseTag} placeholder="v1.2.3" disabled={busy} />
        <ReleaseField label="Commit SHA (optional)" value={commitSha} onChange={setCommitSha} placeholder="abc1234…" disabled={busy} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Planned start (optional)</span>
          <input
            type="datetime-local"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Planned end (optional)</span>
          <input
            type="datetime-local"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 disabled:opacity-50"
          />
        </label>
        <ReleaseField label="Summary (optional)" value={summary} onChange={setSummary} placeholder="Patch tuesday hotfix" disabled={busy} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !applicationId || !releaseTag}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Create draft"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {state.created ? "created" : "already existed"} · {state.releaseTag}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function ReleaseField({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}
