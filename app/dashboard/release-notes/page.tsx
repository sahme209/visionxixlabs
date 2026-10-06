"use client";

/**
 * /dashboard/release-notes — Phase 500.
 *
 * Inbox of release-notes drafts. Operators edit bullets while in
 * 'draft', review (locks edits), publish (seals + records URL).
 */

import { useEffect, useState } from "react";
import {
  DocumentTextIcon,
  CheckCircleIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface NotesView {
  id: string;
  releaseId: string;
  status: "draft" | "reviewed" | "published" | "unknown";
  bullets: string[];
  headline: string | null;
  source: "manual" | "ai" | "imported" | "unknown";
  reviewedByUserId: string | null;
  reviewedAtIso: string | null;
  publishedByUserId: string | null;
  publishedAtIso: string | null;
  publishedUrl: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

interface ListData {
  generatedAt: string;
  drafts: NotesView[];
  summary: { total: number; draft: number; reviewed: number; published: number };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<NotesView["status"], string> = {
  draft:     "bg-white/15 text-zinc-300 border-white/25",
  reviewed:  "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:   "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function ReleaseNotesPage() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/release-notes-list", { credentials: "include" })
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
        kicker={`ReleaseOps · release notes${data ? ` · ${data.summary.draft} drafts` : ""}`}
        title={<>Every release. <span className="text-zinc-500">A polished note.</span></>}
        description="Per-release notes drafts with closed-union state machine: draft → reviewed → published. Bullets persist as a normalized JSON array — the AI generator (Phase 442) and operator manual edits write into the same shape."
        helps="Use this page to draft, review, and publish customer-facing notes for each release. Publishing seals the draft + records an outbound URL."
        connectFirst="No connector needed — operator-driven. AI generation hooks into the upsert path with source='ai'."
        engineers={["Release Captain", "PMM", "Comms"]}
        requiresApproval="Once published, the draft is sealed — operators must create a new draft to amend."
        actions={[
          { label: "Releases",      href: "/dashboard/releases" },
          { label: "Release audit", href: "/dashboard/release-audit" },
        ]}
        safetyNote="Per-org isolation · reject-by-default transitions · published is sealed"
      />

      <UpsertPanel onSaved={loadList} />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={DocumentTextIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={DocumentTextIcon} label="Drafting" value={String(data.summary.draft)} tone={data.summary.draft > 0 ? "amber" : "zinc"} />
          <Stat icon={SparklesIcon} label="Reviewed" value={String(data.summary.reviewed)} tone="zinc" />
          <Stat icon={CheckCircleIcon} label="Published" value={String(data.summary.published)} tone="emerald" />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading release notes…
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
        data.drafts.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No release-note drafts yet. Use the panel above to seed one for any release.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {data.drafts.map((d) => <DraftCard key={d.id} draft={d} onChanged={loadList} />)}
          </div>
        )
      )}
    </div>
  );
}

function DraftCard({ draft, onChanged }: { draft: NotesView; onChanged: () => void }) {
  const [busy, setBusy] = useState<"review" | "publish" | "revoke" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState("");

  async function transition(action: "review" | "publish" | "revoke") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/release-notes-transition", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId: draft.releaseId, action,
          ...(action === "publish" && publishedUrl ? { publishedUrl } : {}),
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.hint ?? j.error);
        setBusy(null);
      } else {
        onChanged();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[draft.status]}`}>
          {draft.status}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">source: {draft.source}</span>
        <span className="text-[10px] font-mono text-zinc-500">release: {draft.releaseId}</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          updated {new Date(draft.updatedAtIso).toLocaleString()}
        </span>
      </div>
      {draft.headline && <p className="text-[13px] font-semibold text-white mb-2">{draft.headline}</p>}
      <ul className="space-y-1 text-[12.5px] text-zinc-200 ml-4 list-disc">
        {draft.bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {draft.publishedUrl && (
        <p className="text-[10.5px] font-mono text-emerald-300 mt-2">↳ published at {draft.publishedUrl}</p>
      )}
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
        {draft.status === "draft" && (
          <button type="button" onClick={() => transition("review")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-white/[0.12] bg-white/[0.03] text-white hover:bg-violet-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "review" ? "…" : "Mark reviewed"}
          </button>
        )}
        {draft.status === "reviewed" && (
          <>
            <input
              type="text"
              aria-label="Publish URL"
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
              placeholder="publish URL (optional)"
              disabled={busy !== null}
              className="flex-1 min-w-[180px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none disabled:opacity-50"
            />
            <button type="button" onClick={() => transition("publish")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
              {busy === "publish" ? "…" : "Publish"}
            </button>
            <button type="button" onClick={() => transition("revoke")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait">
              {busy === "revoke" ? "…" : "Revoke"}
            </button>
          </>
        )}
        {err && <span className="text-rose-300">✗ {err}</span>}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof DocumentTextIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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
   Upsert panel.
   ────────────────────────────────────────────────────────────── */

type UpsertState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; bullets: number }
  | { kind: "error"; message: string };

function UpsertPanel({ onSaved }: { onSaved: () => void }) {
  const [state, setState] = useState<UpsertState>({ kind: "closed" });
  const [releaseId, setReleaseId] = useState("");
  const [headline, setHeadline] = useState("");
  const [raw, setRaw] = useState("");

  function reset() {
    setReleaseId(""); setHeadline(""); setRaw("");
    setState({ kind: "closed" });
  }

  async function submit() {
    const bullets = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/release-notes-upsert", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId, bullets,
          ...(headline ? { headline } : {}),
          source: "manual",
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", bullets: j.data.draft.bullets.length });
        onSaved();
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
          + Draft release notes
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">Draft release notes</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <NotesField label="Release ID" value={releaseId} onChange={setReleaseId} placeholder="rel_..." disabled={busy} />
        <NotesField label="Headline (optional)" value={headline} onChange={setHeadline} placeholder="v1.2.3 — payments revamp" disabled={busy} />
      </div>
      <label className="block">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Bullets (one per line, ≤ 500 chars each)</span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder={"Improved checkout speed by 40% (#1234)\nFixed sign-in loop on Safari (#1245)\nAdded Slack hand-off to remediation runs"}
          disabled={busy}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId || !raw.trim()}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Save draft"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">✓ saved · {state.bullets} bullets</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function NotesField({ label, value, onChange, placeholder, disabled }: {
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
