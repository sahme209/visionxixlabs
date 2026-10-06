"use client";

/**
 * /dashboard/applications — Phase 493.
 * Inventory + onboarding for Application rows. Every Release ties to
 * an Application via Application.id, so onboarding starts here.
 */

import { useEffect, useState } from "react";
import {
  RectangleStackIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

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

export default function ApplicationsPage() {
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
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · applications${data ? ` · ${data.summary.total} tracked` : ""}`}
        title={<>Every product. <span className="text-zinc-500">In one inventory.</span></>}
        description="Applications are the top-level governance unit. Every release, repository, component, and policy violation ties back here. Register applications first so the rest of the platform has somewhere to anchor data."
        helps="See which applications are tracked, which have releases shipping, and which need onboarding."
        connectFirst="Create an application below, then register its repositories via the Repositories tab."
        engineers={["Engineering Manager", "Release Captain"]}
        requiresApproval="None — operators can self-onboard applications."
        actions={[
          { label: "Releases",     href: "/dashboard/releases" },
          { label: "Repositories", href: "/dashboard/repositories" },
        ]}
        safetyNote="Per-org isolation · slug must be unique within org · idempotent registration"
      />

      <NewApplicationPanel onCreated={loadList} />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading applications…
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
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat icon={RectangleStackIcon} label="Total applications" value={String(data.summary.total)} tone="zinc" />
            <Stat icon={RocketLaunchIcon}   label="With releases"      value={String(data.summary.withReleases)} tone={data.summary.withReleases > 0 ? "emerald" : "zinc"} />
            <Stat icon={CheckCircleIcon}    label="Total components"   value={String(data.summary.totalComponents)} tone="zinc" />
          </div>

          {data.applications.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No applications yet. Create one above to start tracking releases.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.applications.map((a) => (
                <div key={a.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white truncate">{a.name}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{a.slug}</span>
                      {a.ownerTeamLabel && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                          {a.ownerTeamLabel}
                        </span>
                      )}
                      {a.businessTier && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-white/[0.10]">
                          {a.businessTier}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {a.componentCount} components
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {a.releaseCount} releases
                      </span>
                      {a.releasesDeployed > 0 && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          {a.releasesDeployed} deployed
                        </span>
                      )}
                    </div>
                  </div>
                  {a.description && (
                    <p className="text-[11.5px] text-zinc-400 italic">{a.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
        method: "POST",
        credentials: "include",
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
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.025] text-[12px] font-semibold text-white hover:bg-violet-500/[0.12] transition-colors"
        >
          + Register application
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">New application</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>
          cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Slug (required)" value={slug} onChange={setSlug} placeholder="checkout" disabled={busy} />
        <Field label="Name (required)" value={name} onChange={setName} placeholder="Checkout" disabled={busy} />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Owner team" value={team} onChange={setTeam} placeholder="payments" disabled={busy} />
        <Field label="Business tier" value={tier} onChange={setTier} placeholder="tier_1" disabled={busy} />
      </div>
      <Field label="Description" value={desc} onChange={setDesc} placeholder="Short summary of what this app does." multiline disabled={busy} />
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !slug || !name}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Register"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {state.created ? "created" : "already existed"} · {state.slug}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {state.message}</span>
        )}
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
      <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      )}
    </label>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof RectangleStackIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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
