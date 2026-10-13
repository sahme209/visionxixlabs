"use client";

import { useCallback, useEffect, useState } from "react";

type Tool = { name: string; description: string; riskLevel: "low" | "medium" | "high" };
type GovernanceData = {
  canManage: boolean;
  providerPolicy: { enabled: boolean; allowedProviders: string[]; modelSelections: Record<string, string>; fallbackOrder: string[] };
  availableProviders: string[];
  gatewayModels: Array<{ id: string; label: string; tier: string }> | null;
  gatewayCatalogLive: boolean;
  agentIdentity: { displayName: string; enabled: boolean; allowedTools: string[]; updatedAt: string } | null;
  autonomy: { mode: string; perCycleActionLimit: number; rationale: string } | null;
  budget: { defaultMaxCostCents: number | null } | null;
  tools: Tool[];
};

async function patchPolicy(body: Record<string, unknown>) {
  const response = await fetch("/api/control/ai-governance", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "policy_update_failed");
}

export function AIGovernancePanel() {
  const [data, setData] = useState<GovernanceData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/control/ai-governance", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { ok?: boolean; data?: GovernanceData; error?: string } | null;
    if (!response.ok || !payload?.data) throw new Error(payload?.error ?? "governance_unavailable");
    setData(payload.data);
  }, []);

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "governance_unavailable")); }, [load]);

  async function save(section: string, body: Record<string, unknown>) {
    setSaving(section);
    setError("");
    try {
      await patchPolicy({ section, ...body });
      await load();
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
  const autonomy = data.autonomy ?? { mode: "observer", perCycleActionLimit: 1, rationale: "" };
  const budgetCents = data.budget?.defaultMaxCostCents ?? 2500;

  return (
    <div className="mt-10 space-y-10">
      {error && <div role="alert" className="border-y border-red-400/30 py-4 text-sm text-red-300">{error}</div>}
      {!data.canManage && <p className="border-y border-white/[0.08] py-4 text-sm text-zinc-400">You can inspect this policy. An organization owner or admin must change it.</p>}

      <section className="border-t border-white/[0.08] pt-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.025em]">Approved model routing</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Inference is routed through Vercel AI Gateway only. This policy never stores provider keys.</p>
          </div>
          <span className={`text-xs ${data.gatewayCatalogLive ? "text-emerald-400" : "text-amber-300"}`}>{data.gatewayCatalogLive ? "Live catalog verified" : "Catalog unavailable"}</span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-xs text-zinc-500">Gateway model
            <select id="gateway-model" defaultValue={selectedModel} disabled={!data.canManage || !data.gatewayCatalogLive} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-zinc-100">
              <option value="service-default">Service-managed default</option>
              {data.gatewayModels?.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </label>
          <button disabled={!data.canManage || saving === "provider_policy"} onClick={() => {
            const model = (document.getElementById("gateway-model") as HTMLSelectElement).value;
            void save("provider_policy", { enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: model }, fallbackOrder: ["vercel_gateway"] });
          }} className="rounded-lg bg-[#f54e00] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Save model policy</button>
        </div>
      </section>

      <section className="border-t border-white/[0.08] pt-7">
        <h2 className="text-xl font-medium tracking-[-0.025em]">Agent identity &amp; tool permissions</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">The model can see and request only selected tools. Write tools still require backend approval regardless of this allowlist.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {data.tools.map((tool) => (
            <label key={tool.name} title={tool.description} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#191919] px-3 py-2 text-xs text-zinc-300">
              <input type="checkbox" name="agent-tool" value={tool.name} defaultChecked={identity.allowedTools.includes(tool.name)} disabled={!data.canManage} className="accent-[#f54e00]" />
              {tool.name.replaceAll("_", " ")} <span className="text-zinc-600">{tool.riskLevel}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="grow text-xs text-zinc-500">Identity name<input id="agent-name" defaultValue={identity.displayName} disabled={!data.canManage} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-zinc-100" /></label>
          <label className="flex h-10 items-center gap-2 text-sm text-zinc-300"><input id="agent-enabled" type="checkbox" defaultChecked={identity.enabled} disabled={!data.canManage} className="accent-[#f54e00]" /> Enabled</label>
          <button disabled={!data.canManage || saving === "agent_identity"} onClick={() => {
            const allowedTools = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="agent-tool"]:checked')).map((input) => input.value);
            void save("agent_identity", { displayName: (document.getElementById("agent-name") as HTMLInputElement).value, enabled: (document.getElementById("agent-enabled") as HTMLInputElement).checked, allowedTools });
          }} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium disabled:opacity-40">Save identity</button>
        </div>
      </section>

      <section className="grid gap-8 border-t border-white/[0.08] pt-7 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-medium tracking-[-0.025em]">Bounded autonomy</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Autonomy never overrides approvals, environment policy, or authorization.</p>
          <select id="autonomy-mode" defaultValue={autonomy.mode} disabled={!data.canManage} className="mt-4 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm">
            <option value="observer">Observe and recommend</option><option value="review">Prepare for review</option><option value="assisted">Execute approved non-production actions</option><option value="autonomous">Execute explicitly authorized workflows</option>
          </select>
          <label className="mt-4 block text-xs text-zinc-500">Maximum actions per cycle<input id="action-limit" type="number" min={1} max={50} defaultValue={autonomy.perCycleActionLimit} disabled={!data.canManage} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm" /></label>
          <button disabled={!data.canManage || saving === "autonomy"} onClick={() => void save("autonomy", { mode: (document.getElementById("autonomy-mode") as HTMLSelectElement).value, perCycleActionLimit: Number((document.getElementById("action-limit") as HTMLInputElement).value), rationale: "Configured in Axiom Control" })} className="mt-4 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium disabled:opacity-40">Save autonomy</button>
        </div>
        <div>
          <h2 className="text-xl font-medium tracking-[-0.025em]">Organization spending limit</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">A hard backend cap for an AI workforce run. Prepaid-credit enforcement remains separate and always applies.</p>
          <label className="mt-4 block text-xs text-zinc-500">Maximum cost per run (USD)<input id="budget-dollars" type="number" min="0.01" max="1000000" step="0.01" defaultValue={(budgetCents / 100).toFixed(2)} disabled={!data.canManage} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm" /></label>
          <button disabled={!data.canManage || saving === "budget"} onClick={() => void save("budget", { defaultMaxCostCents: Math.round(Number((document.getElementById("budget-dollars") as HTMLInputElement).value) * 100), rationale: "Configured in Axiom Control" })} className="mt-4 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium disabled:opacity-40">Save spending limit</button>
        </div>
      </section>
    </div>
  );
}
