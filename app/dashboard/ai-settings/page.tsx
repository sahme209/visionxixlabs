"use client";

/**
 * /dashboard/ai-settings — operator-facing AI provider settings.
 *
 * Three panels:
 *   1. Active provider + model summary
 *   2. Configured providers (sorted by priority) — each shows env
 *      readiness, default model, recommended model list
 *   3. Health check + ad-hoc generation tester
 *
 * Service-managed providers only. Workspace policies decide which configured
 * routes may be used; credentials and provider billing details never render.
 */

import { useCallback, useEffect, useState } from "react";
import {
  SparklesIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon,
  BoltIcon, PlayIcon,
} from "@heroicons/react/24/outline";

interface AiPolicyAdminResp {
  policy: { enabled: boolean; allowedProviders: ProviderName[]; modelSelections: Partial<Record<ProviderName, string>>; fallbackOrder: ProviderName[] };
  availableProviders: ProviderName[];
}

type ProviderName =
  | "openai" | "anthropic" | "github_models" | "ollama" | "lm_studio" | "groq" | "hugging_face"
  | "openrouter" | "gemini" | "cloudflare" | "mock";

interface RegisteredModel { id: string; label: string; tier: string; family: string; freeNote: string }
interface ProviderRow {
  provider: ProviderName; configured: boolean; defaultModel: string;
  priority: number; models: RegisteredModel[];
}
interface StatusResp {
  policyEnabled: boolean; activeProvider: ProviderName | null; activeModel: string | null;
  providers: ProviderRow[];
}
interface HealthRow {
  ok: boolean; provider: ProviderName; model: string; latencyMs: number; reason?: string;
}
interface HealthResp { rows: HealthRow[]; generatedAt: string }
interface GenerateResp {
  text: string; provider: ProviderName; model: string;
  latencyMs: number; finishReason: string;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
}

const LABEL: Record<ProviderName, string> = {
  openai: "OpenAI GPT", anthropic: "Anthropic Claude",
  github_models: "GitHub Models", ollama: "Ollama (local)", lm_studio: "LM Studio (local)",
  groq: "Groq", hugging_face: "Hugging Face", openrouter: "OpenRouter",
  gemini: "Gemini", cloudflare: "Cloudflare Workers AI", mock: "Mock (no network)",
};

export default function AISettingsPage() {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [health, setHealth] = useState<HealthResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [tryPrompt, setTryPrompt] = useState("Say hello in one short sentence.");
  const [tryResp, setTryResp] = useState<GenerateResp | null>(null);
  const [tryError, setTryError] = useState<string | null>(null);
  const [tryBusy, setTryBusy] = useState(false);
  // Master AI toggle — undefined while loading, null when the signed-in
  // user isn't a workspace owner/admin (the /api/account/ai-policy GET
  // itself enforces this server-side; absence of adminPolicy here just
  // hides the control, it is not the authorization boundary).
  const [adminPolicy, setAdminPolicy] = useState<AiPolicyAdminResp | null | undefined>(undefined);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  // Per-provider toggles — which provider is busy right now (only one
  // at a time; the PUT replaces the whole policy document).
  const [providerToggleBusy, setProviderToggleBusy] = useState<ProviderName | null>(null);
  const [providerToggleError, setProviderToggleError] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    setLoadingStatus(true);
    fetch("/api/ai/status", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: StatusResp; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setStatus(j.data);
        else setError(j.error?.userMessage ?? "Settings unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoadingStatus(false));
  }, []);

  const loadAdminPolicy = useCallback(() => {
    fetch("/api/account/ai-policy", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: AiPolicyAdminResp }) => {
        setAdminPolicy(j.ok && j.data ? j.data : null);
      })
      .catch(() => setAdminPolicy(null));
  }, []);

  const toggleAi = useCallback(() => {
    if (!adminPolicy || toggleBusy) return;
    const next = !adminPolicy.policy.enabled;
    setToggleBusy(true);
    setToggleError(null);
    fetch("/api/account/ai-policy", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        next
          ? { enabled: true, allowedProviders: adminPolicy.availableProviders, modelSelections: {}, fallbackOrder: [] }
          : { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] },
      ),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; error?: string }) => {
        if (!j.ok) {
          setToggleError(j.error === "provider_unavailable" ? "No AI provider is currently configured for this service." : "Could not update the AI setting.");
          return;
        }
        loadAdminPolicy();
        loadStatus();
      })
      .catch(() => setToggleError("Network error."))
      .finally(() => setToggleBusy(false));
  }, [adminPolicy, toggleBusy, loadAdminPolicy, loadStatus]);

  // Toggle a single provider in/out of allowedProviders. Normalization
  // on the server (normalizeWorkspaceAIProviderPolicy) rejects
  // allowedProviders: [] while enabled: true, so unchecking the last
  // remaining provider is refused client-side with an explanation
  // instead of firing a request that will 422.
  const toggleProvider = useCallback((provider: ProviderName) => {
    if (!adminPolicy || !adminPolicy.policy.enabled || providerToggleBusy) return;
    const currentlyAllowed = adminPolicy.policy.allowedProviders.includes(provider);
    if (currentlyAllowed && adminPolicy.policy.allowedProviders.length <= 1) {
      setProviderToggleError("At least one provider must stay enabled while AI is on. Turn off the master switch instead.");
      return;
    }
    const nextAllowed = currentlyAllowed
      ? adminPolicy.policy.allowedProviders.filter((p) => p !== provider)
      : [...adminPolicy.policy.allowedProviders, provider];
    const nextModelSelections = { ...adminPolicy.policy.modelSelections };
    if (currentlyAllowed) delete nextModelSelections[provider];
    const nextFallbackOrder = adminPolicy.policy.fallbackOrder.filter((p) => nextAllowed.includes(p));
    setProviderToggleBusy(provider);
    setProviderToggleError(null);
    fetch("/api/account/ai-policy", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        allowedProviders: nextAllowed,
        modelSelections: nextModelSelections,
        fallbackOrder: nextFallbackOrder,
      }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; error?: string }) => {
        if (!j.ok) {
          setProviderToggleError(j.error === "provider_unavailable" ? "That provider is not currently configured for this service." : "Could not update this provider.");
          return;
        }
        loadAdminPolicy();
        loadStatus();
      })
      .catch(() => setProviderToggleError("Network error."))
      .finally(() => setProviderToggleBusy(null));
  }, [adminPolicy, providerToggleBusy, loadAdminPolicy, loadStatus]);

  const runHealth = useCallback(() => {
    setLoadingHealth(true);
    fetch("/api/ai/health", { method: "POST", credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: HealthResp }) => {
        if (j.ok && j.data) setHealth(j.data);
      })
      .finally(() => setLoadingHealth(false));
  }, []);

  const runTry = useCallback(() => {
    setTryBusy(true); setTryError(null); setTryResp(null);
    fetch("/api/ai/generate", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: tryPrompt, maxTokens: 128 }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: GenerateResp; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setTryResp(j.data);
        else setTryError(j.error?.userMessage ?? "Generation failed. No simulated response was returned.");
      })
      .catch((err) => setTryError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setTryBusy(false));
  }, [tryPrompt]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { loadAdminPolicy(); }, [loadAdminPolicy]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <SparklesIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              AI providers
            </span>
          </span>
          <button
            onClick={loadStatus}
            disabled={loadingStatus}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loadingStatus ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          AI with <span className="text-gradient">governed routes.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          The service exposes only configured provider families. Workspace policy controls the approved routes
          and fallback order; when those routes are unavailable, Axiom returns an honest error instead of a
          simulated answer. Credentials and provider billing accounts remain server-only.
        </p>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {status && (
        <>
          <div className="rounded-2xl border border-indigo-500/[0.18] bg-indigo-500/[0.04] p-5 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-300">Active</p>
              {adminPolicy && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-zinc-400">AI features</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={adminPolicy.policy.enabled}
                    aria-label={adminPolicy.policy.enabled ? "Turn AI off for this workspace" : "Turn AI on for this workspace"}
                    onClick={toggleAi}
                    disabled={toggleBusy}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      adminPolicy.policy.enabled ? "bg-emerald-500/80" : "bg-white/[0.12]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform ${
                        adminPolicy.policy.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[16px] font-semibold text-white">{!status.policyEnabled ? "AI is disabled for this workspace" : status.activeProvider ? LABEL[status.activeProvider] : "No approved live provider"}</span>
              {status.activeModel && <span className="text-[11px] font-mono text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5">
                model: {status.activeModel}
              </span>}
            </div>
            {toggleError && (
              <p role="alert" aria-live="assertive" className="mt-2 text-[11px] text-rose-300">{toggleError}</p>
            )}
            {adminPolicy === null && (
              <p className="mt-2 text-[11px] text-zinc-500">Only a workspace owner or admin can change this setting.</p>
            )}
            {adminPolicy && adminPolicy.policy.enabled && adminPolicy.availableProviders.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Per-provider</p>
                <ul className="space-y-2">
                  {adminPolicy.availableProviders.map((provider) => {
                    const allowed = adminPolicy.policy.allowedProviders.includes(provider);
                    return (
                      <li key={provider} className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={allowed}
                          aria-label={allowed ? `Turn off ${LABEL[provider]}` : `Turn on ${LABEL[provider]}`}
                          onClick={() => toggleProvider(provider)}
                          disabled={providerToggleBusy !== null}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                            allowed ? "bg-emerald-500/80" : "bg-white/[0.12]"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              allowed ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <span className="text-[12px] text-zinc-300">{LABEL[provider]}</span>
                      </li>
                    );
                  })}
                </ul>
                {providerToggleError && (
                  <p role="alert" aria-live="assertive" className="mt-2 text-[11px] text-rose-300">{providerToggleError}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 mb-8">
            {status.providers.map((p, index) => (
              <div key={p.provider} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">#{index + 1}</span>
                  <span className="text-[14px] font-semibold text-white">{LABEL[p.provider]}</span>
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    p.configured
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-white/15 text-zinc-300 border-white/30"
                  }`}>
                    {p.configured ? "Approved" : "Unavailable"}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 ml-auto">default: {p.defaultModel}</span>
                </div>
                <details className="text-[11px]">
                  <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300 uppercase tracking-wider">
                    {p.models.length} approved model option{p.models.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 space-y-0.5">
                    {p.models.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-zinc-300">
                        <span className="font-mono text-[10px] text-zinc-500 w-16 truncate">{m.tier}</span>
                        <span className="font-mono text-indigo-300 truncate">{m.id}</span>
                        <span className="text-zinc-500 truncate">— {m.label}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BoltIcon className="h-3.5 w-3.5 text-indigo-300" />
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Provider health</h2>
              <button
                onClick={runHealth}
                disabled={loadingHealth}
                className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-3 w-3 ${loadingHealth ? "animate-spin" : ""}`} />
                Run health check
              </button>
            </div>
            {health ? (
              <ul className="space-y-1.5 text-[12px]">
                {health.rows.map((r) => (
                  <li key={r.provider} className="flex items-center gap-2">
                    {r.ok ? <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-300" /> : <XCircleIcon className="h-3.5 w-3.5 text-rose-300" />}
                    <span className="font-mono text-indigo-300 w-40 truncate">{r.provider}</span>
                    <span className="font-mono text-zinc-400 truncate">{r.model}</span>
                    <span className="font-mono text-zinc-500 ml-auto">{r.latencyMs}ms</span>
                    {!r.ok && <span className="text-[10px] font-mono text-rose-300">{r.reason ?? "fail"}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-zinc-500">Click run health check to ping each provider approved for this workspace.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-12">
            <div className="flex items-center gap-2 mb-3">
              <PlayIcon className="h-3.5 w-3.5 text-indigo-300" />
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Try it</h2>
            </div>
            <textarea
              aria-label="Test prompt"
              value={tryPrompt}
              onChange={(e) => setTryPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] font-mono text-zinc-200 focus:border-indigo-400/60 focus:outline-none mb-3"
            />
            <button
              onClick={runTry}
              disabled={tryBusy || !tryPrompt.trim()}
              className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <PlayIcon className="h-3.5 w-3.5" />
              {tryBusy ? "Running…" : "Generate"}
            </button>
            {tryError && (
              <div className="mt-3 text-[11px] font-mono text-rose-300">{tryError}</div>
            )}
            {tryResp && (
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/30 p-3">
                <div className="flex items-center gap-2 mb-2 text-[10px] font-mono text-zinc-500">
                  <span>provider: <span className="text-indigo-300">{tryResp.provider}</span></span>
                  <span>model: <span className="text-zinc-300">{tryResp.model}</span></span>
                  <span>{tryResp.latencyMs}ms</span>
                  <span>finish: {tryResp.finishReason}</span>
                </div>
                <pre className="whitespace-pre-wrap text-[12px] text-zinc-100 font-mono leading-relaxed">{tryResp.text}</pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
