"use client";

import { useEffect, useState } from "react";

type Policy = { enabled: boolean; allowedProviders: string[]; modelSelections: Record<string, string>; fallbackOrder: string[] };
type ModelOption = { id: string; label: string };
type LoadState = "loading" | "ready" | "migration_pending" | "unavailable" | "saving" | "saved" | "error";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI GPT",
  anthropic: "Anthropic Claude",
  xai: "xAI Grok",
  github_models: "GitHub Models",
  gemini: "Google Gemini",
  groq: "Groq",
  hugging_face: "Hugging Face",
  openrouter: "OpenRouter",
  cloudflare: "Cloudflare AI",
  ollama: "Ollama",
  lm_studio: "LM Studio",
};

export function WorkspaceAISettingsForm() {
  const [policy, setPolicy] = useState<Policy>({ enabled: true, allowedProviders: [], modelSelections: {}, fallbackOrder: [] });
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<Record<string, ModelOption[]>>({});
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/account/ai-policy", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok || !body?.data?.policy || !Array.isArray(body?.data?.availableProviders) || !body?.data?.availableModels) {
          setState(body?.error === "provider_policy_migration_pending" ? "migration_pending" : "unavailable");
          return;
        }
        setPolicy(body.data.policy);
        setAvailableProviders(body.data.availableProviders);
        setAvailableModels(body.data.availableModels);
        setState("ready");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, []);

  const allowed = policy.allowedProviders;

  async function save() {
    if (policy.enabled && !allowed.length) return;
    setState("saving");
    const fallbackOrder = policy.enabled ? policy.fallbackOrder.filter((provider) => allowed.includes(provider)) : [];
    const response = await fetch("/api/account/ai-policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: policy.enabled, allowedProviders: policy.enabled ? policy.allowedProviders : [], modelSelections: policy.enabled ? policy.modelSelections : {}, fallbackOrder }),
    });
    if (!response.ok) { setState("error"); return; }
    const body = await response.json().catch(() => null);
    setPolicy(body?.data?.policy ?? { ...policy, fallbackOrder });
    setState("saved");
  }

  function moveFallback(provider: string, direction: -1 | 1) {
    setState("ready");
    setPolicy((current) => {
      const order = current.fallbackOrder.length ? [...current.fallbackOrder] : [...current.allowedProviders];
      const index = order.indexOf(provider);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= order.length) return current;
      [order[index], order[next]] = [order[next], order[index]];
      return { ...current, fallbackOrder: order };
    });
  }

  function toggleProvider(provider: string) {
    setState("ready");
    setPolicy((current) => {
      const isAllowed = current.allowedProviders.includes(provider);
      const allowedProviders = isAllowed
        ? current.allowedProviders.filter((item) => item !== provider)
        : [...current.allowedProviders, provider];
      const fallbackOrder = isAllowed
        ? current.fallbackOrder.filter((item) => item !== provider)
        : [...current.fallbackOrder, provider];
      const modelSelections = { ...current.modelSelections };
      if (isAllowed) delete modelSelections[provider];
      else if (availableModels[provider]?.[0]) modelSelections[provider] = availableModels[provider][0].id;
      return { ...current, allowedProviders, modelSelections, fallbackOrder };
    });
  }

  function selectModel(provider: string, model: string) {
    setState("ready");
    setPolicy((current) => ({ ...current, modelSelections: { ...current.modelSelections, [provider]: model } }));
  }

  function toggleWorkspaceAI(enabled: boolean) {
    setState("ready");
    // Keep the draft choices until Save. The request normalizes a disabled
    // policy to an empty allowlist, so the server remains the enforcement
    // boundary while an owner can reconsider without rebuilding the form.
    setPolicy((current) => ({ ...current, enabled }));
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7" aria-labelledby="ai-policy-title">
      <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300">Workspace control</p>
      <h2 id="ai-policy-title" className="mt-3 text-lg font-medium text-zinc-100">AI provider policy</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">Review the provider families approved by the service, select their approved models, and set fallback order. Credentials, prompts, and provider billing accounts never appear here.</p>

      {state === "loading" && <p className="mt-6 text-sm text-zinc-500">Loading workspace policy…</p>}
      {state === "migration_pending" && <p className="mt-6 text-sm leading-6 text-zinc-500">AI policy controls are waiting for the approved workspace-policy database migration. Service-level provider controls remain in effect until that migration is applied.</p>}
      {state === "unavailable" && <p className="mt-6 text-sm leading-6 text-zinc-500">AI policy is available to workspace owners after at least one provider is enabled by the service.</p>}
      {state !== "loading" && state !== "migration_pending" && state !== "unavailable" && (
        <div className="mt-6">
          {availableProviders.length === 0 ? <p className="text-sm leading-6 text-zinc-500">No live AI provider is enabled for this workspace yet. Axiom will not offer a simulated or unconfigured provider as a choice.</p> : (
            <>
              <fieldset className="rounded-xl border border-white/[0.07] p-3">
                <legend className="px-1 text-xs font-medium text-zinc-300">Workspace AI access</legend>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04]">
                  <input type="checkbox" checked={policy.enabled} onChange={(event) => toggleWorkspaceAI(event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-300" />
                  <span><span className="font-medium text-zinc-200">Allow governed AI generation in this workspace</span><span className="mt-1 block text-xs leading-5 text-zinc-500">Turning this off blocks requests routed under this workspace policy on the server. It does not expose or remove service-managed credentials.</span></span>
                </label>
              </fieldset>
              {!policy.enabled && <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-3 text-sm leading-6 text-amber-100/80">Governed AI generation is disabled for this workspace. Save this policy to enforce the block.</p>}
              {policy.enabled && <>
              <fieldset className="mt-4 rounded-xl border border-white/[0.07] p-3">
                <legend className="px-1 text-xs font-medium text-zinc-300">Allowed provider families</legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {availableProviders.map((provider) => {
                    const selected = allowed.includes(provider);
                    return <label key={provider} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04]">
                      <input type="checkbox" checked={selected} onChange={() => toggleProvider(provider)} className="h-4 w-4 accent-violet-300" />
                      {PROVIDER_LABELS[provider] ?? provider}
                    </label>;
                  })}
                </div>
              </fieldset>
              {allowed.length > 0 && <fieldset className="mt-4 rounded-xl border border-white/[0.07] p-3">
                <legend className="px-1 text-xs font-medium text-zinc-300">Approved model per provider</legend>
                <div className="mt-1 space-y-2">
                  {allowed.map((provider) => {
                    const options = availableModels[provider] ?? [];
                    return <label key={provider} className="flex flex-col gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
                      <span>{PROVIDER_LABELS[provider] ?? provider}</span>
                      <select value={policy.modelSelections[provider] ?? options[0]?.id ?? ""} onChange={(event) => selectModel(provider, event.target.value)} disabled={options.length === 0} className="min-h-9 rounded-lg border border-white/[0.1] bg-black/20 px-2 text-sm text-zinc-200 disabled:opacity-50">
                        {options.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                      </select>
                    </label>;
                  })}
                </div>
              </fieldset>}
              {allowed.length > 0 && <ol className="mt-4 overflow-hidden rounded-xl border border-white/[0.07]">
              {(policy.fallbackOrder.length ? policy.fallbackOrder : allowed).map((provider, index) => (
                <li key={provider} className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
                  <div><p className="text-sm text-zinc-200">{PROVIDER_LABELS[provider] ?? provider}</p><p className="mt-0.5 text-xs text-zinc-600">{index === 0 ? "Primary route" : `Fallback ${index}`}</p></div>
                  <div className="flex items-center gap-1"><button type="button" aria-label={`Move ${provider} earlier`} onClick={() => moveFallback(provider, -1)} disabled={index === 0} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30">↑</button><button type="button" aria-label={`Move ${provider} later`} onClick={() => moveFallback(provider, 1)} disabled={index === allowed.length - 1} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30">↓</button></div>
                </li>
              ))}
            </ol>
              }
              {allowed.length === 0 && <p className="mt-3 text-xs leading-5 text-amber-200/80">Choose at least one service-enabled provider before saving a workspace policy.</p>}
              </>}
            </>
          )}
          <div className="mt-5 flex items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={state === "saving" || (policy.enabled && allowed.length === 0)} className="min-h-10 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50">{state === "saving" ? "Saving…" : "Save AI policy"}</button>
            {state === "saved" && <p className="text-sm text-emerald-300">Policy saved and audited.</p>}
            {state === "error" && <p className="text-sm text-rose-300">Could not save the policy. Try again.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
