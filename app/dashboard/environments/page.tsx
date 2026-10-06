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
import { AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";

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
            <EnvironmentRow key={e.id} environment={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvironmentRow({ environment: e }: { environment: EnvironmentListItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 px-1.5 py-0.5 rounded border border-white/[0.08]"
          >
            {expanded ? "hide AWS deploy" : "AWS deploy"}
          </button>
        </div>
      </div>
      {expanded && <DeploymentTargetPanel environmentId={e.id} />}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   AWS deploy target — role ARN / region / ECS cluster+service per
   environment, plus the workflow template the tenant adds to their
   own repo once.
   ────────────────────────────────────────────────────────────── */

interface DeploymentTargetData {
  roleArn: string;
  region: string;
  ecsCluster: string;
  ecsService: string;
}

type TargetState =
  | { kind: "loading" }
  | { kind: "loaded"; target: DeploymentTargetData | null }
  | { kind: "error"; message: string };

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "ok" } | { kind: "error"; message: string };

function DeploymentTargetPanel({ environmentId }: { environmentId: string }) {
  const [state, setState] = useState<TargetState>({ kind: "loading" });
  const [roleArn, setRoleArn] = useState("");
  const [region, setRegion] = useState("");
  const [ecsCluster, setEcsCluster] = useState("");
  const [ecsService, setEcsService] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/dashboard/deployment-target?environmentId=${encodeURIComponent(environmentId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const t = j.data.target;
          setState({ kind: "loaded", target: t });
          if (t) { setRoleArn(t.roleArn); setRegion(t.region); setEcsCluster(t.ecsCluster); setEcsService(t.ecsService); }
        } else {
          setState({ kind: "error", message: j.hint ?? j.error });
        }
      })
      .catch((e) => setState({ kind: "error", message: e instanceof Error ? e.message : "network error" }));
  }, [environmentId]);

  async function save() {
    setSaveState({ kind: "saving" });
    try {
      const res = await fetch("/api/dashboard/deployment-target", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentId, roleArn, region, ecsCluster, ecsService }),
      });
      const j = await res.json();
      if (j.ok) {
        setSaveState({ kind: "ok" });
        setState({ kind: "loaded", target: { roleArn: j.data.roleArn, region: j.data.region, ecsCluster: j.data.ecsCluster, ecsService: j.data.ecsService } });
      } else {
        setSaveState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setSaveState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  async function copyTemplate() {
    await navigator.clipboard.writeText(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE);
    setTemplateCopied(true);
    setTimeout(() => setTemplateCopied(false), 1500);
  }

  if (state.kind === "loading") {
    return <div className="mt-3 pt-3 border-t border-white/[0.04] text-[11.5px] text-zinc-500">Loading deploy target…</div>;
  }
  if (state.kind === "error") {
    return <div className="mt-3 pt-3 border-t border-white/[0.04] text-[11.5px] text-rose-300">{state.message}</div>;
  }

  const busy = saveState.kind === "saving";
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.04]">
      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">AWS ECS deploy target</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Role ARN" value={roleArn} onChange={setRoleArn} placeholder="arn:aws:iam::123456789012:role/axiom-deploy" disabled={busy} />
        <Field label="Region" value={region} onChange={setRegion} placeholder="us-east-1" disabled={busy} />
        <Field label="ECS cluster" value={ecsCluster} onChange={setEcsCluster} placeholder="prod-cluster" disabled={busy} />
        <Field label="ECS service" value={ecsService} onChange={setEcsService} placeholder="web-service" disabled={busy} />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !roleArn || !region || !ecsCluster || !ecsService}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Saving…" : "Save deploy target"}
        </button>
        {saveState.kind === "ok" && <span className="text-[11.5px] font-mono text-emerald-300">✓ saved</span>}
        {saveState.kind === "error" && <span className="text-[11.5px] font-mono text-rose-300">✗ {saveState.message}</span>}
      </div>
      <button type="button" onClick={() => setShowTemplate((v) => !v)} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 underline underline-offset-2">
        {showTemplate ? "hide" : "show"} the GitHub Actions workflow to add to your repo
      </button>
      {showTemplate && (
        <div className="mt-2 rounded-lg border border-white/[0.08] bg-black/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-zinc-500">.github/workflows/axiom-deploy-aws-ecs.yml</span>
            <button type="button" onClick={copyTemplate} className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200">
              {templateCopied ? "✓ copied" : "copy"}
            </button>
          </div>
          <pre className="text-[10.5px] font-mono text-zinc-300 whitespace-pre overflow-x-auto">{AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE}</pre>
          <p className="mt-2 text-[10.5px] text-zinc-500">
            Add this file to your repo once. It assumes the role above via OIDC (no AWS keys stored in GitHub) — the role&apos;s own trust policy on your AWS account controls what it&apos;s actually allowed to do.
          </p>
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
