"use client";

import { AGENT_PROFILES, profileToolNames } from "@/lib/axiom/agentRuntime/agentProfiles";
import { useCallback, useEffect, useRef, useState } from "react";

type Tool = { name: string; description: string; riskLevel: "low" | "medium" | "high" };
type GovernanceData = {
  canManage: boolean;
  providerPolicy: { enabled: boolean; allowedProviders: string[]; modelSelections: Record<string, string>; fallbackOrder: string[] };
  availableProviders: string[];
  gatewayModels: Array<{ id: string; label: string; tier: string }> | null;
  gatewayCatalogLive: boolean;
  agentIdentityState?: "ready" | "migration_pending" | "unavailable";
  agentIdentity: { displayName: string; enabled: boolean; allowedTools: string[]; updatedAt: string } | null;
  autonomy: { mode: string; perCycleActionLimit: number; rationale: string } | null;
  budget: { defaultMaxCostCents: number | null } | null;
  tools: Tool[];
};

function policyErrorMessage(code: unknown): string {
  const messages: Record<string, string> = {
    agent_identity_migration_pending: "Agent permissions storage needs an administrator-reviewed database update. No enablement was confirmed. Do not repeatedly retry.",
    agent_identity_unavailable: "Agent permissions could not be saved reliably. Reload the saved policy before trying again; the last request may have completed.",
    policy_audit_unconfirmed: "The policy may already be saved, but its audit record was not confirmed. Reload the saved policy and ask an administrator to review the audit failure before retrying.",
    workspace_owner_required: "Only a workspace owner or administrator can change this policy.",
    invalid_request_origin: "This request could not be verified. Reload this page from the normal website and sign in again.",
    invalid_agent_identity_policy: "Review the Agent name and selected tools. An enabled Agent needs at least one allowed tool.",
  };
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(messages, code) ? messages[code]
    : "The policy update was not confirmed. Reload the saved policy before trying again; the last request may have completed.";
}

async function patchPolicy(body: Record<string, unknown>) {
  const response = await fetch("/api/control/ai-governance", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(policyErrorMessage(payload?.error));
}

const views = ["Configuration", "Tool permissions", "Agent profiles"] as const;

export function AIGovernancePanel() {
  const [view, setView] = useState<number>(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  function selectView(index: number) { setView(index); tabRefs.current[index]?.focus(); }

  const [data, setData] = useState<GovernanceData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/control/ai-governance", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { ok?: boolean; data?: GovernanceData; error?: string } | null;
    if (!response.ok || !payload?.data) throw new Error(payload?.error ?? "governance_unavailable");
    setData(payload.data);
  }, []);

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "governance_unavailable")); }, [load]);

  async function save(section: string, body: Record<string, unknown>) {
    if (saving) return;
    setNotice("");
    setSaving(section);
    setError("");
    try {
      await patchPolicy({ section, ...body });
      await load();
      const labels: Record<string, string> = { provider_policy: "Model policy", agent_identity: "Agent identity", autonomy: "Autonomy policy", budget: "Spending limit" };
      const label = labels[section] ?? "Policy";
      setNotice(`${label} saved and reloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "policy_update_failed");
    } finally {
      setSaving("");
    }
  }

  if (!data) return <div className="mt-10 border-y border-white/[0.08] py-6 text-sm text-zinc-500">{error || "Loading verified organization policy…"}</div>;

  const selectedModel = data.providerPolicy.modelSelections.vercel_gateway ?? "service-default";
  const identity = data.agentIdentity ?? {
    displayName: "Axiom Agent",
    enabled: false,
    allowedTools: data.tools.filter((tool) => tool.riskLevel === "low").map((tool) => tool.name),
    updatedAt: "",
  };
  const identityUnavailable = data.agentIdentityState !== undefined && data.agentIdentityState !== "ready";
  const identityReadOnly = !data.canManage || Boolean(saving) || identityUnavailable;
  const autonomy = data.autonomy ?? { mode: "observer", perCycleActionLimit: 1, rationale: "" };
  const budgetCents = data.budget === null ? 2500 : data.budget.defaultMaxCostCents;

  const fieldClass = "mt-2 block h-9 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-xs text-zinc-100 disabled:opacity-50";
  const buttonClass = "h-8 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-40";
  const cardClass = "rounded-xl border border-white/[0.08] bg-white/[0.015] p-5";
  function saveIdentity() {
    const allowedTools = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="agent-tool"]:checked')).map(input => input.value);
    void save("agent_identity", { displayName: (document.getElementById("agent-name") as HTMLInputElement).value, enabled: (document.getElementById("agent-enabled") as HTMLInputElement).checked, allowedTools });
  }

  function saveBudget() {
    const input = document.getElementById("budget-dollars") as HTMLInputElement;
    const dollars = input.valueAsNumber;
    const cents = Math.round(dollars * 100);
    if (!input.value.trim() || !input.validity.valid || !Number.isFinite(dollars) || cents < 1 || cents > 100000000 || Math.abs(dollars * 100 - cents) > 0.000001) {
      setNotice("");
      setError("Enter a spending limit from $0.01 to $1,000,000, in whole cents.");
      input.focus();
      return;
    }
    void save("budget", { defaultMaxCostCents: cents, rationale: "Configured in Axiom Control" });
  }

  return (
    <div className="mt-6" onChange={() => setNotice("")}>
      {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] px-4 py-3 text-xs text-emerald-200">{notice}</p>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-400/20 px-4 py-3 text-xs leading-5 text-red-300">{error}</div>}
      {!data.canManage && <p className="mb-4 text-xs leading-5 text-zinc-400">You can inspect this policy. An organization owner or admin must change it.</p>}
      <div role="tablist" aria-label="Agent settings" className="mb-5 flex gap-5 overflow-x-auto border-b border-white/[0.08]">
        {views.map((label, index) => <button key={label} type="button" role="tab" ref={element => { tabRefs.current[index] = element; }} id={`agent-tab-${index}`} aria-controls={`agent-panel-${index}`} aria-selected={view === index} tabIndex={view === index ? 0 : -1} disabled={Boolean(saving)} onClick={() => selectView(index)} onKeyDown={event => {
          if (saving) return;
          const next = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : null;
          if (next !== null) { event.preventDefault(); selectView(next); }
        }} className={`shrink-0 border-b-2 pb-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-400 disabled:opacity-50 ${view === index ? "border-zinc-100 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>{label}</button>)}
      </div>

      <div role="tabpanel" id="agent-panel-0" aria-labelledby="agent-tab-0" hidden={view !== 0}>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={cardClass} aria-labelledby="agent-identity-heading">
            <div className="flex items-center justify-between gap-3"><h2 id="agent-identity-heading" className="text-sm font-medium">Agent identity</h2><span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">{identityUnavailable ? "Unavailable" : identity.enabled ? "Enabled" : "Disabled"}</span></div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Your workspace Agent, with access bounded by saved permissions.</p>
            {identityUnavailable && <p role="alert" className="mt-3 text-xs leading-5 text-amber-300">{data.agentIdentityState === "migration_pending" ? "Agent permissions storage needs an administrator-reviewed database update. Enabling and editing permissions is unavailable until storage is ready." : "Agent permissions storage is unavailable. Saved permissions could not be verified; changes are disabled until service recovery."}</p>}
            <label className="mt-4 block text-xs text-zinc-400">Identity name<input id="agent-name" defaultValue={identity.displayName} disabled={identityReadOnly} className={fieldClass} /></label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input id="agent-enabled" type="checkbox" defaultChecked={!identityUnavailable && identity.enabled} disabled={identityReadOnly} className="accent-zinc-200" /> Enabled</label>
              <button type="button" disabled={identityReadOnly} onClick={saveIdentity} className={buttonClass}>Save identity</button>
            </div>
            <button type="button" disabled={Boolean(saving)} onClick={() => selectView(1)} className="mt-4 text-xs text-zinc-400 underline underline-offset-4 hover:text-zinc-100 disabled:opacity-50">Review tool permissions</button>
          </section>

          <section className={cardClass} aria-labelledby="agent-model-heading">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="agent-model-heading" className="text-sm font-medium">Approved model routing</h2><span className={`text-[11px] ${data.gatewayCatalogLive ? "text-emerald-300" : "text-amber-300"}`}>{data.gatewayCatalogLive ? "Live catalog verified" : "Catalog unavailable"}</span></div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Choose a service-approved model for this workspace.</p>
            <label className="mt-4 block text-xs text-zinc-400">Gateway model<select id="gateway-model" defaultValue={selectedModel} disabled={!data.canManage || Boolean(saving) || !data.gatewayCatalogLive} className={fieldClass}>
              <option value="service-default">Service-managed default</option>{data.gatewayModels?.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select></label>
            <div className="mt-4 flex justify-end"><button type="button" disabled={!data.canManage || Boolean(saving) || !data.gatewayCatalogLive} onClick={() => void save("provider_policy", { enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: (document.getElementById("gateway-model") as HTMLSelectElement).value }, fallbackOrder: ["vercel_gateway"] })} className={buttonClass}>Save model policy</button></div>
            <p className="mt-4 text-[11px] leading-5 text-zinc-500">{data.gatewayCatalogLive ? "Routing and credentials remain managed by the service." : "Model changes require a verified catalog. Your saved policy remains unchanged."}</p>
          </section>

          <section className={cardClass} aria-labelledby="agent-autonomy-heading">
            <h2 id="agent-autonomy-heading" className="text-sm font-medium">Bounded autonomy</h2><p className="mt-2 text-xs leading-5 text-zinc-500">Approvals and environment policy always apply.</p>
            <label className="mt-4 block text-xs text-zinc-400">Autonomy mode<select id="autonomy-mode" defaultValue={autonomy.mode} disabled={!data.canManage || Boolean(saving)} className={fieldClass}>
              <option value="observer">Observe and recommend</option><option value="review">Prepare for review</option><option value="assisted">Execute approved non-production actions</option><option value="autonomous">Execute explicitly authorized workflows</option>
            </select></label>
            <label className="mt-4 block text-xs text-zinc-400">Maximum actions per cycle<input id="action-limit" type="number" min={1} max={50} defaultValue={autonomy.perCycleActionLimit} disabled={!data.canManage || Boolean(saving)} className={fieldClass} /></label>
            <div className="mt-4 flex justify-end"><button type="button" disabled={!data.canManage || Boolean(saving)} onClick={() => void save("autonomy", { mode: (document.getElementById("autonomy-mode") as HTMLSelectElement).value, perCycleActionLimit: Number((document.getElementById("action-limit") as HTMLInputElement).value), rationale: "Configured in Axiom Control" })} className={buttonClass}>Save autonomy</button></div>
          </section>

          <section className={cardClass} aria-labelledby="agent-budget-heading">
            <h2 id="agent-budget-heading" className="text-sm font-medium">Organization spending limit</h2><p className="mt-2 text-xs leading-5 text-zinc-500">A per-run cap alongside prepaid-credit enforcement.</p>
            <label className="mt-4 block text-xs text-zinc-400">Maximum cost per run (USD)<input id="budget-dollars" type="number" min="0.01" max="1000000" step="0.01" defaultValue={budgetCents === null ? "" : (budgetCents / 100).toFixed(2)} placeholder={budgetCents === null ? "No workspace cap configured" : undefined} disabled={!data.canManage || Boolean(saving)} className={fieldClass} /></label>
            <div className="mt-4 flex justify-end"><button type="button" disabled={!data.canManage || Boolean(saving)} onClick={saveBudget} className={buttonClass}>Save spending limit</button></div>
          </section>
        </div>
      </div>

      <div role="tabpanel" id="agent-panel-1" aria-labelledby="agent-tab-1" hidden={view !== 1}>
        <section className={cardClass} aria-labelledby="agent-tools-heading">
          <h2 id="agent-tools-heading" className="text-sm font-medium">Tool access</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500">Select the tools this Agent may request. Write tools still require backend approval. Changes are saved with the Agent identity.</p>
          {identityUnavailable && <p role="alert" className="mt-3 text-xs leading-5 text-amber-300">Saved permissions are unavailable. Editing remains disabled until storage is ready.</p>}
          <div className="mt-4 space-y-3">{([['low','Read tools'],['medium','Workspace changes'],['high','High-risk tools']] as const).map(([risk,label]) => <details key={risk} className="rounded-lg border border-white/[0.08]">
            <summary className="cursor-pointer px-4 py-3 text-[13px] text-zinc-200"><span>{label}</span><span className="ml-2 text-xs tabular-nums text-zinc-500">{data.tools.filter(tool => tool.riskLevel === risk).length}</span></summary>
            <div className="divide-y divide-white/[0.05] border-t border-white/[0.06]">{data.tools.filter(tool => tool.riskLevel === risk).map(tool => <label key={tool.name} className="flex cursor-pointer items-start gap-3 px-4 py-3">
              <input type="checkbox" name="agent-tool" value={tool.name} aria-label={`${tool.name.replaceAll('_',' ')} ${tool.riskLevel}`} defaultChecked={!identityUnavailable && identity.allowedTools.includes(tool.name)} disabled={identityReadOnly} className="mt-0.5 shrink-0 accent-zinc-200" />
              <span className="min-w-0"><span className="block text-xs font-medium text-zinc-200">{tool.name.replaceAll('_',' ')}</span><span className="mt-1 block text-xs leading-5 text-zinc-500">{tool.description}</span></span>
            </label>)}</div>
          </details>)}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-zinc-500">Unsaved edits do not change effective permissions.</p><button type="button" disabled={identityReadOnly} onClick={saveIdentity} className={buttonClass}>Save identity</button></div>
        </section>
      </div>

      <div role="tabpanel" id="agent-panel-2" aria-labelledby="agent-tab-2" hidden={view !== 2}>
        <section aria-label="Effective specialized Agent permissions" className={cardClass}>
          <h2 className="text-sm font-medium">Saved Agent profiles</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500">Inspect each Agent’s saved tool scope. Operation modes, authorization, and approvals can restrict it further.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{AGENT_PROFILES.map(profile => {
            const tools = identity.enabled ? profileToolNames(profile, identity.allowedTools) : [];
            return <details key={profile.id} className="rounded-lg border border-white/[0.08] p-4 text-xs text-zinc-400"><summary className="cursor-pointer text-zinc-200"><span>{profile.label}</span><span className="mt-1 block pl-4 text-[11px] text-zinc-500">{identityUnavailable ? "Saved permissions unavailable" : `${tools.length} tools in saved policy`}</span></summary><p className="mt-3 leading-5">{profile.description}</p><div className="mt-3 flex flex-wrap gap-2 break-all">{identityUnavailable ? <span>Saved permissions could not be verified.</span> : tools.length ? tools.map(tool => <code key={tool}>{tool}</code>) : <span>No tools currently enabled.</span>}</div></details>;
          })}</div>
        </section>
      </div>
    </div>
  );
}
