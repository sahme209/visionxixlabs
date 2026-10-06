"use client";

import { useState, useEffect } from "react";
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  RocketLaunchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EnvelopeIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { WEBSITE_BUILD_TIERS, resolveTier } from "@/lib/websiteBuildPricing";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

type Lead = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source?: string;
  fullPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  agentStatus?: string;
  actionsTaken?: string[];
  lastEmailSent?: { subject: string; sentAt: string } | null;
  executionLogIds?: string[];
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedAi, setExpandedAi] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"website-request" | "contact" | "all">("website-request");
  const [runningAgent, setRunningAgent] = useState(false);

  const loadLeads = () =>
    fetch(`/api/leads/list?source=${sourceFilter}`)
      .then((r) => r.json())
      .then((data) => setLeads(data.leads || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadLeads();
  }, [sourceFilter]);

  const runAction = async (leadId: string, action: "generate" | "deploy" | "publish") => {
    setActioning(leadId);
    try {
      const endpoint =
        action === "generate"
          ? `/api/leads/${leadId}/generate`
          : action === "deploy"
          ? `/api/leads/${leadId}/deploy-preview`
          : `/api/leads/${leadId}/publish`;
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await loadLeads();
      } else {
        alert(data.error || "Action failed");
      }
    } catch (e) {
      alert("Action failed");
    } finally {
      setActioning(null);
    }
  };

  const runAgentWorker = async () => {
    setRunningAgent(true);
    try {
      const res = await fetch("/api/agents/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await loadLeads();
        alert(`Processed ${data.processed ?? 0} job(s)`);
      } else alert(data.error || "Failed");
    } catch {
      alert("Failed to run agent");
    } finally {
      setRunningAgent(false);
    }
  };

  const upgradeTier = async (leadId: string, newTier: string) => {
    setUpgrading(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/upgrade-tier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier }),
      });
      if (res.ok) await loadLeads();
      else alert((await res.json()).error || "Failed");
    } catch {
      alert("Failed");
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <Reveal direction="up" blur delay={0.05}>
        <h1 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]">
          <span className="text-gradient">Leads</span>
        </h1>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
            {(["website-request", "contact", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  sourceFilter === s
                    ? "bg-violet-500/10 text-violet-400"
                    : "text-zinc-400 hover:bg-white/[0.04]"
                }`}
              >
                {s === "website-request" ? "Website" : s === "contact" ? "Contact" : "All"}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal direction="up" blur delay={0.1}>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <p className="text-zinc-400">
            {sourceFilter === "contact"
              ? "Contact form submissions. AI resolution agent runs via cron or manually below."
              : sourceFilter === "all"
              ? "All leads across sources."
              : "Website Request submissions. Use buttons to regenerate AI package, preview, or publish."}
          </p>
          {(sourceFilter === "contact" || sourceFilter === "all") && (
            <button
              type="button"
              onClick={runAgentWorker}
              disabled={runningAgent}
              className="btn-huly cta-glow inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {runningAgent ? "Running..." : "Run agent worker"}
            </button>
          )}
        </div>
      </Reveal>

      <div className="space-y-4">
        {leads.length === 0 ? (
          <Reveal direction="up" blur delay={0.15}>
            <div className="glass-card rounded-2xl border-2 border-dashed border-white/[0.08] p-12 text-center">
              <DocumentTextIcon className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
              <p className="text-zinc-400">
                {sourceFilter === "contact" ? "No contact leads yet." : sourceFilter === "all" ? "No leads yet." : "No website request leads yet."}
              </p>
            </div>
          </Reveal>
        ) : (
          <Stagger delay={0.1} interval={0.06}>
            {leads.map((lead) => {
              const payload = lead.fullPayload || {};
              const form = (payload.form as Record<string, unknown>) || {};
              const contactPayload = lead.source === "contact" ? payload : {};
              const previewUrl = payload.previewUrl as string | undefined;
              const productionUrl = payload.productionUrl as string | undefined;
              const aiPackage = payload.aiPackage as Record<string, unknown> | undefined;
              const isActioning = actioning === lead.id;
              const showAiOutput = expandedAi === lead.id;

              return (
                <div
                  key={lead.id}
                  className="glass-card card-hover animated-border card-inner-glow rounded-xl p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-white tracking-[-0.04em]">
                        {(form.name || contactPayload.name || lead.name) as string || "—"}
                      </h2>
                      <p className="text-sm text-zinc-400">{lead.email}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {lead.source === "contact"
                          ? `${(contactPayload.company as string) || ""} · ${lead.agentStatus ?? "pending"} · ${new Date(lead.createdAt).toLocaleString()}`
                          : `${form.company as string || ""} · ${form.tier as string || "starter"} · ${lead.status} · ${new Date(lead.createdAt).toLocaleString()}`}
                      </p>
                      {previewUrl && (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-sm text-violet-400 hover:underline"
                        >
                          Preview: {previewUrl}
                        </a>
                      )}
                      {productionUrl && (
                        <a
                          href={productionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-1 text-sm text-emerald-400 hover:underline"
                        >
                          Production: {productionUrl}
                        </a>
                      )}
                    </div>
                    {lead.source !== "contact" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => runAction(lead.id, "generate")}
                        disabled={isActioning}
                        className="btn-huly inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.1] disabled:opacity-50 transition-colors"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                        Regenerate package
                      </button>
                      <button
                        onClick={() => runAction(lead.id, "deploy")}
                        disabled={isActioning}
                        className="btn-huly inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
                      >
                        <CloudArrowUpIcon className="h-4 w-4" />
                        Regenerate preview
                      </button>
                      <button
                        onClick={() => runAction(lead.id, "publish")}
                        disabled={isActioning}
                        className="btn-huly inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                      >
                        <RocketLaunchIcon className="h-4 w-4" />
                        Publish
                      </button>
                    </div>
                    )}
                  </div>
                  {lead.source !== "contact" && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-2">
                    <button
                      onClick={() => setExpandedAi(showAiOutput ? null : lead.id)}
                      className="btn-huly inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.1] transition-colors"
                    >
                      {showAiOutput ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                      View AI output
                    </button>
                    <select
                      value={resolveTier((form.tier as string) || "starter")}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && v !== (form.tier as string)) upgradeTier(lead.id, v);
                      }}
                      disabled={upgrading === lead.id}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300"
                    >
                      {Object.values(WEBSITE_BUILD_TIERS).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  )}
                  {showAiOutput && aiPackage && (
                    <pre className="mt-2 p-4 rounded-lg bg-[#09090b] border border-white/[0.06] text-xs text-zinc-300 overflow-auto max-h-64">
                      {JSON.stringify(aiPackage, null, 2)}
                    </pre>
                  )}
                  {typeof form.message === "string" && form.message && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Message</p>
                      <p className="text-sm text-zinc-400 whitespace-pre-wrap">{form.message}</p>
                    </div>
                  )}
                  {lead.source === "contact" && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-zinc-500">Agent:</span>
                        <span className={`font-semibold ${
                          lead.agentStatus === "RESOLVED" ? "text-emerald-400" :
                          lead.agentStatus === "NEEDS_INFO" ? "text-zinc-400" :
                          lead.agentStatus === "ESCALATED" ? "text-rose-400" :
                          "text-zinc-400"
                        }`}>
                          {lead.agentStatus ?? "pending"}
                        </span>
                      </div>
                      {lead.actionsTaken && lead.actionsTaken.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 mb-1">Actions taken</p>
                          <ul className="text-xs text-zinc-400 space-y-0.5">
                            {lead.actionsTaken.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {lead.lastEmailSent && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <EnvelopeIcon className="h-4 w-4" />
                          <span>Last email: {lead.lastEmailSent.subject} ({new Date(lead.lastEmailSent.sentAt).toLocaleString()})</span>
                        </div>
                      )}
                      {lead.executionLogIds && lead.executionLogIds.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <CpuChipIcon className="h-4 w-4" />
                          <span>Execution logs: {lead.executionLogIds.join(", ")}</span>
                        </div>
                      )}
                      {typeof contactPayload.message === "string" && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 mb-1">Message</p>
                          <p className="text-sm text-zinc-400 whitespace-pre-wrap">{contactPayload.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Stagger>
        )}
      </div>
    </div>
  );
}
