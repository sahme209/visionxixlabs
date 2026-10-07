import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Bot, Check, Cloud, Github, Package, Search, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { ViewShell } from "../components/Primitives";
import { desktopClient, type AgentSkillCatalogItem } from "../lib/desktopClient";

type Filter = "all" | "skills" | "plugins" | "installed";
interface IntegrationStatus {
  cloud: Array<{ provider: "aws" | "azure" | "gcp"; status: string; lastTransitionAt: string | null }>;
  github: { status: string; repositorySelection: string };
  collaboration: Array<{ provider: "slack" | "teams" | "linear"; status: string; lastValidatedAt: string | null }>;
}

const PROVIDERS = [
  { id: "github", name: "GitHub", category: "Source control", detail: "Repository-scoped reading, branches, commits, pull requests, and workflow dispatch.", Icon: Github },
  { id: "slack", name: "Slack", category: "Collaboration", detail: "Governed release notifications using explicitly consented workspace access.", Icon: Sparkles },
  { id: "teams", name: "Microsoft Teams", category: "Collaboration", detail: "Verified Microsoft workspace identity; message authority remains separately gated.", Icon: Bot },
  { id: "linear", name: "Linear", category: "Work management", detail: "Issue context and governed follow-up using read and issues:create scopes.", Icon: Package },
  { id: "aws", name: "AWS ECS", category: "Cloud delivery", detail: "OIDC-backed ECS deployments using the tenant's workflow, role, cluster, and service configuration.", Icon: Cloud },
] as const;

type BrowserProvider = "github" | "slack" | "teams" | "linear";
const TRUSTED_CONSENT_HOSTS: Record<BrowserProvider, readonly string[]> = {
  github: ["github.com"], slack: ["slack.com"], teams: ["login.microsoftonline.com"], linear: ["linear.app"],
};

export function PluginsSkillsView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [skills, setSkills] = useState<AgentSkillCatalogItem[] | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [skillResult, integrationResult] = await Promise.all([desktopClient.listAgentSkills(), desktopClient.integrationStatus()]);
    if (skillResult.ok) setSkills(skillResult.data.skills);
    else setNotice("The workspace skill catalog could not be loaded.");
    if (integrationResult.ok) setIntegrations(integrationResult.data);
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  async function updateSkill(skill: AgentSkillCatalogItem, action: "install" | "enable" | "disable" | "remove") {
    setWorking(skill.id); setNotice(null);
    const result = await desktopClient.updateAgentSkill(skill.id, action);
    if (result.ok) {
      setNotice(`${skill.name} is now ${result.data.status.replaceAll("_", " ")}. Agent workflow guidance updates on the next message.`);
      await load();
    } else {
      setNotice(`Could not update ${skill.name}. ${result.error}`);
    }
    setWorking(null);
  }

  async function connectProvider(provider: BrowserProvider) {
    setWorking(`provider:${provider}`); setNotice(null);
    try {
      const result = await desktopClient.startIntegrationConnection(provider);
      if (!result.ok) throw new Error(result.error);
      const destination = new URL(result.data.consentUrl);
      if (destination.protocol !== "https:" || !TRUSTED_CONSENT_HOSTS[provider].includes(destination.hostname)) throw new Error("untrusted consent destination");
      await open(destination.toString());
      setNotice("Secure provider consent opened in your browser. Return here when finished.");
    } catch (cause) {
      setNotice(`Could not start the secure connection. ${cause instanceof Error ? cause.message : "Try again."}`);
    }
    setWorking(null);
  }

  const providerState = (provider: (typeof PROVIDERS)[number]["id"]) => {
    if (!integrations) return "checking";
    if (provider === "github") return integrations.github.status;
    if (provider === "aws") return integrations.cloud.find((item) => item.provider === "aws")?.status ?? "not_connected";
    return integrations.collaboration.find((item) => item.provider === provider)?.status ?? "not_connected";
  };
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSkills = useMemo(() => (skills ?? []).filter((skill) => {
    const matches = !normalizedQuery || `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(normalizedQuery);
    return matches && filter !== "plugins" && (filter !== "installed" || skill.status !== "not_installed");
  }), [skills, normalizedQuery, filter]);
  const visibleProviders = PROVIDERS.filter((provider) => {
    const matches = !normalizedQuery || `${provider.name} ${provider.detail} ${provider.category}`.toLowerCase().includes(normalizedQuery);
    const state = providerState(provider.id);
    return matches && filter !== "skills" && (filter !== "installed" || !["not_connected", "checking"].includes(state));
  });

  return (
    <ViewShell>
      <div className="mx-auto w-full max-w-5xl pb-12">
        <div className="flex items-start justify-between gap-6">
          <div><h1 className="text-2xl font-semibold tracking-[-0.035em]">Plugins & Skills</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">Extend the governed Agent with verified systems and reusable deployment workflows. Capabilities never bypass workspace policy or approval.</p></div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-[11px] text-emerald-200"><ShieldCheck className="h-3.5 w-3.5" />Guardrails always on</div>
        </div>

        <div className="mt-7 flex gap-3">
          <label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] px-3 text-zinc-500 focus-within:border-white/20"><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plugins and skills" className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600" /></label>
          <button type="button" onClick={onOpenSettings} className="rounded-xl border border-white/[0.1] px-4 text-xs text-zinc-300 hover:bg-white/[0.06]">Connection settings</button>
        </div>
        <div className="mt-3 flex gap-2">{(["all", "plugins", "skills", "installed"] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full border px-3 py-1.5 text-xs capitalize transition ${filter === item ? "border-white/20 bg-white/[0.09] text-white" : "border-white/[0.07] text-zinc-500 hover:text-zinc-300"}`}>{item}</button>)}</div>
        {notice && <div role="status" className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs text-zinc-300">{notice}</div>}

        {visibleProviders.length > 0 && <section className="mt-8"><div className="mb-3 flex items-center gap-2 text-xs text-zinc-400"><Package className="h-4 w-4" />Plugins</div><div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018]">{visibleProviders.map((provider) => {
          const state = providerState(provider.id); const connected = state === "active" || state === "validated_read_only";
          return <div key={provider.id} className="flex min-h-[78px] items-center gap-4 px-5 py-3"><span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035]"><provider.Icon className="h-4 w-4 text-zinc-300" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm text-zinc-100">{provider.name}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${connected ? "border-emerald-400/15 text-emerald-200" : "border-white/[0.08] text-zinc-500"}`}>{state.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{provider.detail}</p></div>{connected || provider.id === "aws" ? <button type="button" onClick={onOpenSettings} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]">{connected ? "Manage" : "Configure"}</button> : <button type="button" disabled={working !== null} onClick={() => void connectProvider(provider.id)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{working === `provider:${provider.id}` ? "Opening…" : "Connect ↗"}</button>}</div>;
        })}</div></section>}

        {visibleSkills.length > 0 && <section className="mt-8"><div className="mb-3 flex items-center gap-2 text-xs text-zinc-400"><Wrench className="h-4 w-4" />Skills</div><div className="grid gap-3 sm:grid-cols-2">{visibleSkills.map((skill) => <div key={skill.id} className="flex min-h-[178px] flex-col rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-300/[0.08]"><Sparkles className="h-4 w-4 text-violet-200" /></span><span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{skill.category}</span></div><h2 className="mt-4 text-sm font-medium text-zinc-100">{skill.name}</h2><p className="mt-1 flex-1 text-xs leading-5 text-zinc-500">{skill.description}</p><div className="mt-4 flex items-center justify-between"><span className="text-[10px] text-zinc-600">{skill.toolNames.length} governed tools</span>{skill.status === "not_installed" ? <button type="button" disabled={working !== null} onClick={() => void updateSkill(skill, "install")} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{working === skill.id ? "Adding…" : "Add"}</button> : <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><Check className="h-3 w-3" />Installed</span><button type="button" disabled={working !== null} onClick={() => void updateSkill(skill, skill.status === "enabled" ? "disable" : "enable")} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-300">{skill.status === "enabled" ? "Disable" : "Enable"}</button><button type="button" disabled={working !== null} onClick={() => void updateSkill(skill, "remove")} className="rounded-lg px-2 py-2 text-[11px] text-zinc-600 hover:bg-rose-400/[0.06] hover:text-rose-300">Remove</button></div>}</div></div>)}</div></section>}

        {visibleProviders.length === 0 && visibleSkills.length === 0 && <div className="mt-10 rounded-2xl border border-white/[0.07] p-10 text-center"><p className="text-sm text-zinc-300">No matching capabilities</p><p className="mt-2 text-xs text-zinc-600">Try a different search or filter.</p></div>}
      </div>
    </ViewShell>
  );
}
