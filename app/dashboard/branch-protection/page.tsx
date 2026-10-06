"use client";

/**
 * /dashboard/branch-protection — Phase 499.
 *
 * Per-branch protection snapshots. Operators can paste GitHub
 * branch-protection JSON to refresh a snapshot until the automated
 * sync job lands.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface SnapshotView {
  id: string;
  repositoryId: string;
  branchName: string;
  strength: "strong" | "weak" | "none" | "unknown";
  requiresPullRequest: boolean;
  requiredReviewCount: number;
  requiresStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
  requiresSignedCommits: boolean;
  allowsForcePushes: boolean;
  source: string;
  fetchedAtIso: string;
}

interface ListData {
  generatedAt: string;
  snapshots: SnapshotView[];
  summary: { total: number; strong: number; weak: number; none: number };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const STRENGTH_CLASS: Record<SnapshotView["strength"], string> = {
  strong:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  weak:    "bg-white/15 text-zinc-300 border-white/25",
  none:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function BranchProtectionPage() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/branch-protection-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · branch protection${data ? ` · ${data.summary.total} snapshots` : ""}`}
        title={<>Every branch. <span className="text-zinc-500">Protection scored.</span></>}
        description="Per-branch protection snapshots projected from GitHub's branch-protection API. Drives the readiness evaluator's branchGovernance score and the repository inventory's strong / weak / none badge."
        helps="Paste in GitHub branch-protection JSON to register a snapshot. The automated sync that fetches this on its own ships in a follow-on phase."
        connectFirst={"To collect a payload: gh api repos/{owner}/{repo}/branches/{branch}/protection | pbcopy — then paste below."}
        engineers={["DevOps", "Security", "Compliance"]}
        requiresApproval="Snapshots are read-only — strengthening protections happens on the provider side."
        actions={[
          { label: "Repositories", href: "/dashboard/repositories" },
          { label: "Release audit", href: "/dashboard/release-audit" },
        ]}
        safetyNote="Per-org isolation via repository ownership · pure projector · idempotent upsert"
      />

      <RefreshPanel onRefreshed={loadList} />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={ShieldCheckIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={ShieldCheckIcon} label="Strong" value={String(data.summary.strong)} tone="emerald" />
          <Stat icon={ShieldExclamationIcon} label="Weak" value={String(data.summary.weak)} tone={data.summary.weak > 0 ? "amber" : "zinc"} />
          <Stat icon={ShieldExclamationIcon} label="None" value={String(data.summary.none)} tone={data.summary.none > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading snapshots…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-zinc-300" />
            <p className="text-[12px] font-semibold text-zinc-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        data.snapshots.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No protection snapshots yet. Use the panel above to register one.
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {data.snapshots.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STRENGTH_CLASS[s.strength]}`}>
                    {s.strength}
                  </span>
                  <span className="text-[12px] font-semibold text-white">{s.branchName}</span>
                  <span className="text-[10px] font-mono text-zinc-500">repo: {s.repositoryId}</span>
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                    {new Date(s.fetchedAtIso).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  <Flag label="PR required" on={s.requiresPullRequest} extra={s.requiredReviewCount > 0 ? `· ${s.requiredReviewCount} reviewers` : null} />
                  <Flag label="Status checks" on={s.requiresStatusChecks} extra={s.requiredStatusCheckContexts.length > 0 ? `· ${s.requiredStatusCheckContexts.length}` : null} />
                  <Flag label="Signed commits" on={s.requiresSignedCommits} />
                  <Flag label="Force-push" on={s.allowsForcePushes} tone={s.allowsForcePushes ? "rose" : "zinc"} />
                </div>
                <p className="text-[10px] font-mono text-zinc-600 mt-1">source: {s.source}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Flag({ label, on, extra, tone }: {
  label: string; on: boolean; extra?: string | null; tone?: "rose" | "zinc";
}) {
  const onCls = tone === "rose"
    ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  const offCls = "bg-zinc-700/40 text-zinc-400 border-zinc-700/40";
  return (
    <span className={`px-1.5 py-0.5 rounded border ${on ? onCls : offCls}`}>
      {label}{on && extra ? ` ${extra}` : ""}{on ? "" : " · off"}
    </span>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ShieldCheckIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
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
   Refresh panel — paste-in JSON.
   ────────────────────────────────────────────────────────────── */

type RefreshState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; strength: string; branchName: string }
  | { kind: "error"; message: string };

function RefreshPanel({ onRefreshed }: { onRefreshed: () => void }) {
  const [state, setState] = useState<RefreshState>({ kind: "closed" });
  const [repositoryId, setRepositoryId] = useState("");
  const [branchName, setBranchName] = useState("main");
  const [payload, setPayload] = useState("");

  function reset() {
    setRepositoryId(""); setBranchName("main"); setPayload("");
    setState({ kind: "closed" });
  }

  async function submit() {
    let parsed: unknown;
    try { parsed = payload.trim() ? JSON.parse(payload) : {}; }
    catch (e) {
      setState({ kind: "error", message: e instanceof Error ? `payload JSON: ${e.message}` : "payload JSON invalid" });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/branch-protection-refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId, branchName, payload: parsed, source: "manual" }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", strength: j.data.strength, branchName: j.data.branchName });
        onRefreshed();
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
          + Refresh snapshot
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">Refresh branch protection</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Repository ID" value={repositoryId} onChange={setRepositoryId} placeholder="repo_..." disabled={busy} />
        <Field label="Branch" value={branchName} onChange={setBranchName} placeholder="main" disabled={busy} />
      </div>
      <label className="block">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">GitHub branch-protection JSON</span>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={6}
          placeholder={`{"required_pull_request_reviews": {"required_approving_review_count": 2}, "required_status_checks": {"contexts": ["ci/build"]}, ...}`}
          disabled={busy}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !repositoryId || !branchName}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Refresh"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {state.branchName} · {state.strength}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: {
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
