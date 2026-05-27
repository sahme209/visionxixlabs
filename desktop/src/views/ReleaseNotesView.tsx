import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface NotesView {
  id: string;
  releaseId: string;
  status: "draft" | "reviewed" | "published" | "unknown";
  bullets: string[];
  headline: string | null;
  source: "manual" | "ai" | "imported" | "unknown";
  publishedUrl: string | null;
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
  draft:     "bg-amber-500/15 text-amber-300 border-amber-500/25",
  reviewed:  "bg-violet-500/15 text-violet-300 border-violet-500/25",
  published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:   "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function ReleaseNotesView() {
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
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Release notes</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Draft → reviewed → published state machine. AI-generated and manual bullets share the same shape.
        </p>
      </div>

      <UpsertPanel onSaved={loadList} />

      {data && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Drafting" value={String(data.summary.draft)} tone={data.summary.draft > 0 ? "amber" : "zinc"} />
          <Stat label="Reviewed" value={String(data.summary.reviewed)} />
          <Stat label="Published" value={String(data.summary.published)} tone="emerald" />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading release notes…</div>}

      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">Sign in required.</div>
      )}

      {data && (
        data.drafts.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No release-note drafts yet. Use the panel above to seed one for any release.
          </div>
        ) : (
          <div className="space-y-2">
            {data.drafts.map((d) => <DraftCard key={d.id} draft={d} onChanged={loadList} />)}
          </div>
        )
      )}
    </ViewShell>
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
      if (!j.ok) { setErr(j.hint ?? j.error); setBusy(null); }
      else onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
      setBusy(null);
    }
  }

  return (
    <div className="glass-card p-3">
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
      {draft.headline && <p className="text-sm font-semibold text-white mb-2">{draft.headline}</p>}
      <ul className="space-y-1 text-[12.5px] text-zinc-200 ml-4 list-disc">
        {draft.bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      {draft.publishedUrl && (
        <p className="text-[10.5px] font-mono text-emerald-300 mt-2">↳ published at {draft.publishedUrl}</p>
      )}
      <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
        {draft.status === "draft" && (
          <button type="button" onClick={() => transition("review")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-violet-500/30 bg-violet-500/[0.10] text-violet-200 hover:bg-violet-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "review" ? "…" : "Mark reviewed"}
          </button>
        )}
        {draft.status === "reviewed" && (
          <>
            <input
              type="text"
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
              placeholder="publish URL (optional)"
              disabled={busy !== null}
              className="flex-1 min-w-[160px] rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none disabled:opacity-50"
            />
            <button type="button" onClick={() => transition("publish")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
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

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-amber-500/20 text-amber-200",
    rose:    "border-rose-500/20 text-rose-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Upsert panel.
// ─────────────────────────────────────────────────────────────────

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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.16] transition-colors"
        >
          + Draft release notes
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">Draft release notes</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Release ID" value={releaseId} onChange={setReleaseId} placeholder="rel_..." disabled={busy} />
        <Field label="Headline" value={headline} onChange={setHeadline} placeholder="v1.2.3 — payments revamp" disabled={busy} />
      </div>
      <label className="block">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Bullets (one per line)</span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder={"Improved checkout speed by 40% (#1234)\nFixed sign-in loop on Safari (#1245)"}
          disabled={busy}
          className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId || !raw.trim()}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Save draft"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">✓ saved · {state.bullets} bullets</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
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
        className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}
