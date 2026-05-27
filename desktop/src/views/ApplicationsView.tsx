import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 493 — desktop sibling for /dashboard/applications.
 */

interface Row {
  id: string;
  slug: string;
  name: string;
  ownerTeamLabel: string | null;
  businessTier: string | null;
  description: string | null;
  componentCount: number;
  releaseCount: number;
  releasesDeployed: number;
  createdAtIso: string;
}

interface DigestData {
  generatedAt: string;
  applications: Row[];
  summary: { total: number; withReleases: number; totalComponents: number };
}

type RespBody = { ok: true; data: DigestData } | { ok: false; error: string; hint?: string };

export function ApplicationsView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/application-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Applications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Top-level governance unit. Every release, repo, component, and policy ties back here.
        </p>
      </div>

      <NewApplicationPanel onCreated={loadList} />

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading applications…</div>}

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
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total"          value={String(data.summary.total)} />
            <Stat label="With releases"  value={String(data.summary.withReleases)} tone={data.summary.withReleases > 0 ? "emerald" : "zinc"} />
            <Stat label="Components"     value={String(data.summary.totalComponents)} />
          </div>

          {data.applications.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No applications yet. Create one above to start tracking releases.
            </div>
          ) : (
            <div className="space-y-2">
              {data.applications.map((a) => (
                <div key={a.id} className="glass-card p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white truncate">{a.name}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{a.slug}</span>
                      {a.ownerTeamLabel && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                          {a.ownerTeamLabel}
                        </span>
                      )}
                      {a.businessTier && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
                          {a.businessTier}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {a.componentCount} comp
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {a.releaseCount} rel
                      </span>
                      {a.releasesDeployed > 0 && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          {a.releasesDeployed} deployed
                        </span>
                      )}
                    </div>
                  </div>
                  {a.description && (
                    <p className="text-[11px] text-zinc-400 italic">{a.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

type NewState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; created: boolean; slug: string }
  | { kind: "error"; message: string };

function NewApplicationPanel({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<NewState>({ kind: "closed" });
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [tier, setTier] = useState("");
  const [desc, setDesc] = useState("");

  function reset() {
    setSlug(""); setName(""); setTeam(""); setTier(""); setDesc("");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/application-create", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, name,
          ...(team ? { ownerTeamLabel: team } : {}),
          ...(tier ? { businessTier: tier } : {}),
          ...(desc ? { description: desc } : {}),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", created: j.data.created, slug: j.data.slug });
        onCreated();
        setTimeout(reset, 1200);
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
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] text-[11.5px] font-semibold text-violet-200 hover:bg-violet-500/[0.12] transition-colors"
        >
          + Register application
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">New application</p>
        <button type="button" onClick={reset} className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Slug" value={slug} onChange={setSlug} placeholder="checkout" disabled={busy} />
        <Field label="Name" value={name} onChange={setName} placeholder="Checkout" disabled={busy} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Owner team" value={team} onChange={setTeam} placeholder="payments" disabled={busy} />
        <Field label="Business tier" value={tier} onChange={setTier} placeholder="tier_1" disabled={busy} />
      </div>
      <Field label="Description" value={desc} onChange={setDesc} placeholder="Short summary." multiline disabled={busy} />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !slug || !name}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[11.5px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Register"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">
            ✓ {state.created ? "created" : "already existed"} · {state.slug}
          </span>
        )}
        {state.kind === "error" && <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      )}
    </label>
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
