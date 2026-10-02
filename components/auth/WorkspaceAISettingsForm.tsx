"use client";

import { useEffect, useState } from "react";

type Policy = { allowedProviders: string[]; fallbackOrder: string[] };
type LoadState = "loading" | "ready" | "unavailable" | "saving" | "saved" | "error";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI GPT",
  anthropic: "Anthropic Claude",
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
  const [policy, setPolicy] = useState<Policy>({ allowedProviders: [], fallbackOrder: [] });
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/account/ai-policy", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok || !body?.data?.policy || !Array.isArray(body?.data?.availableProviders)) { setState("unavailable"); return; }
        setPolicy(body.data.policy);
        setAvailableProviders(body.data.availableProviders);
        setState("ready");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, []);

  const allowed = policy.allowedProviders;

  async function save() {
    if (!allowed.length) return;
    setState("saving");
    const fallbackOrder = policy.fallbackOrder.filter((provider) => allowed.includes(provider));
    const response = await fetch("/api/account/ai-policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowedProviders: policy.allowedProviders, fallbackOrder }),
    });
    if (!response.ok) { setState("error"); return; }
    const body = await response.json().catch(() => null);
    setPolicy(body?.data?.policy ?? { ...policy, fallbackOrder });
    setState("saved");
  }

  function moveFallback(provider: string, direction: -1 | 1) {
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
    setPolicy((current) => {
      const isAllowed = current.allowedProviders.includes(provider);
      const allowedProviders = isAllowed
        ? current.allowedProviders.filter((item) => item !== provider)
        : [...current.allowedProviders, provider];
      const fallbackOrder = isAllowed
        ? current.fallbackOrder.filter((item) => item !== provider)
        : [...current.fallbackOrder, provider];
      return { allowedProviders, fallbackOrder };
    });
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7" aria-labelledby="ai-policy-title">
      <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300">Workspace control</p>
      <h2 id="ai-policy-title" className="mt-3 text-lg font-medium text-zinc-100">AI provider policy</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">Review the provider families approved by the service and set their fallback order. Credentials, prompts, and provider billing accounts never appear here.</p>

      {state === "loading" && <p className="mt-6 text-sm text-zinc-500">Loading workspace policy…</p>}
      {state === "unavailable" && <p className="mt-6 text-sm leading-6 text-zinc-500">AI policy is available to workspace owners after at least one provider is enabled by the service.</p>}
      {state !== "loading" && state !== "unavailable" && (
        <div className="mt-6">
          {availableProviders.length === 0 ? <p className="text-sm leading-6 text-zinc-500">No live AI provider is enabled for this workspace yet. Axiom will not offer a simulated or unconfigured provider as a choice.</p> : (
            <>
              <fieldset className="rounded-xl border border-white/[0.07] p-3">
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
              {allowed.length > 0 && <ol className="mt-4 overflow-hidden rounded-xl border border-white/[0.07]">
              {(policy.fallbackOrder.length ? policy.fallbackOrder : allowed).map((provider, index) => (
                <li key={provider} className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
                  <div><p className="text-sm text-zinc-200">{PROVIDER_LABELS[provider] ?? provider}</p><p className="mt-0.5 text-xs text-zinc-600">{index === 0 ? "Primary route" : `Fallback ${index}`}</p></div>
                  <div className="flex items-center gap-1"><button type="button" aria-label={`Move ${provider} earlier`} onClick={() => moveFallback(provider, -1)} disabled={index === 0} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30">↑</button><button type="button" aria-label={`Move ${provider} later`} onClick={() => moveFallback(provider, 1)} disabled={index === allowed.length - 1} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30">↓</button></div>
                </li>
              ))}
            </ol>
              }
            </>
          )}
          <div className="mt-5 flex items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={state === "saving" || allowed.length === 0} className="min-h-10 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50">{state === "saving" ? "Saving…" : "Save AI policy"}</button>
            {state === "saved" && <p className="text-sm text-emerald-300">Policy saved and audited.</p>}
            {state === "error" && <p className="text-sm text-rose-300">Could not save the policy. Try again.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
