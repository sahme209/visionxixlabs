"use client";

/**
 * /dashboard/environments.
 *
 * Tenant-wide dev/test/prod (and anywhere between) separation. The
 * Environment model has existed in the schema since Phase 441 but had
 * no CRUD or UI surface — this page is the first place an operator can
 * actually create environments and see them. Releases bind to one via
 * `targetEnvironmentId` on /dashboard/releases.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface EnvironmentListItem {
  id: string;
  slug: string;
  name: string;
  tier: string;
  displayOrder: number;
  hasApprovalPolicy: boolean;
  createdAtIso: string;
}

type RespBody =
  | { ok: true; data: { environments: EnvironmentListItem[] } }
  | { ok: false; error: string; hint?: string };

const TIER_ORDER = ["dev", "test", "qa", "uat", "stage", "preprod", "prod"] as const;

const TIER_CLASS: Record<string, string> = {
  dev: "bg-white/5 text-zinc-300 border-white/[0.08]",
  test: "bg-white/5 text-zinc-300 border-white/[0.08]",
  qa: "bg-white/5 text-zinc-300 border-white/[0.08]",
  uat: "bg-white/5 text-zinc-300 border-white/[0.08]",
  stage: "bg-white/5 text-zinc-300 border-white/[0.08]",
  preprod: "bg-white/5 text-zinc-300 border-white/[0.08]",
  prod: "bg-emerald-500/[0.12] text-emerald-300 border-emerald-500/[0.25]",
};

const STANDARD_SET: { slug: string; name: string; tier: string }[] = [
  { slug: "dev", name: "Development", tier: "dev" },
  { slug: "test", name: "Testing", tier: "test" },
  { slug: "prod", name: "Production", tier: "prod" },
];

export default function EnvironmentsPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/environment-list", { credentials: "include" })
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
        kicker={`ReleaseOps · environments${data ? ` · ${data.environments.length} configured` : ""}`}
        title={<>Dev. Test. <span className="text-zinc-500">Prod.</span></>}
        description="Separate deployment targets so a release can be scoped to exactly one environment — and prod can carry its own approval policy."
        helps="Releases bind to an environment at creation time. A release bound to prod can require stricter approval than one bound to dev."
        connectFirst="Create the environments your pipeline actually deploys to, then bind releases to them on the Releases page."
        engineers={["DevOps", "Release Captain", "Security"]}
        requiresApproval="Creating or editing environments is admin/owner-only — this is tenant-wide configuration."
        actions={[
          { label: "Releases", href: "/dashboard/releases" },
        ]}
        safetyNote="Per-org isolation · unique slug per org · deleting an environment is not supported from here"
      />

      <NewEnvironmentPanel existing={data?.environments ?? []} onCreated={loadList} />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading environments…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Schema migration pending. {errorBody.hint}
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && data.environments.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
          No environments yet. Use the panel above, or the standard dev/test/prod set.
        </div>
      )}

      {data && data.environments.length > 0 && (
        <div className="space-y-3 mb-8">
          {data.environments.map((e) => (
            <div key={e.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ServerStackIcon className="h-4 w-4 text-zinc-400 shrink-0" />
                <p className="text-[13px] font-semibold text-white truncate">{e.name}</p>
                <span className="text-[10px] font-mono text-zinc-500">slug: {e.slug}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${TIER_CLASS[e.tier] ?? TIER_CLASS.dev}`}>
                  {e.tier}
                </span>
                {e.hasApprovalPolicy ? (
                  <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/5 text-zinc-300 border-white/[0.08] inline-flex items-center gap-1">
                    <ShieldCheckIcon className="h-3 w-3" /> approval policy
                  </span>
                ) : (
                  <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/5 text-zinc-500 border-white/[0.08]">
                    no approval policy
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Create — single environment, or the standard dev/test/prod set.
   ────────────────────────────────────────────────────────────── */

type NewEnvState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; created: boolean; name: string }
  | { kind: "error"; message: string };

async function createEnvironment(input: { slug: string; name: string; tier: string }) {
  const res = await fetch("/api/dashboard/environment-create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

function NewEnvironmentPanel({ existing, onCreated }: { existing: EnvironmentListItem[]; onCreated: () => void }) {
  const [state, setState] = useState<NewEnvState>({ kind: "closed" });
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState<string>("dev");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  function reset() {
    setSlug(""); setName(""); setTier("dev");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const j = await createEnvironment({ slug, name, tier });
      if (j.ok) {
        setState({ kind: "ok", created: j.data.created, name: j.data.name });
        onCreated();
        setTimeout(reset, 1200);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  async function createStandardSet() {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      for (const env of STANDARD_SET) {
        const j = await createEnvironment(env);
        if (!j.ok) {
          setBootstrapError(`${env.name}: ${j.hint ?? j.error}`);
          return;
        }
      }
      onCreated();
    } catch (e) {
      setBootstrapError(e instanceof Error ? e.message : "network error");
    } finally {
      setBootstrapping(false);
    }
  }

  const missingStandard = STANDARD_SET.filter((s) => !existing.some((e) => e.slug === s.slug));

  if (state.kind === "closed") {
    return (
      <div className="mb-6 flex items-center justify-end gap-2">
        {missingStandard.length > 0 && (
          <button
            type="button"
            onClick={createStandardSet}
            disabled={bootstrapping}
            className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.025] text-[12px] font-semibold text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
          >
            {bootstrapping ? "Creating…" : `+ Create standard set (${missingStandard.map((s) => s.slug).join("/")})`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.025] text-[12px] font-semibold text-white hover:bg-violet-500/[0.12] transition-colors"
        >
          + New environment
        </button>
        {bootstrapError && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {bootstrapError}</span>
        )}
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">New environment</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="Slug" value={slug} onChange={setSlug} placeholder="staging" disabled={busy} />
        <Field label="Display name" value={name} onChange={setName} placeholder="Staging" disabled={busy} />
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Tier</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 disabled:opacity-50"
          >
            {TIER_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !slug || !name}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Create"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {state.created ? "created" : "already existed"} · {state.name}
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
