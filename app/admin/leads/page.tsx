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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Leads
      </h1>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-1">
          {(["website-request", "contact", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSourceFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sourceFilter === s
                  ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {s === "website-request" ? "Website" : s === "contact" ? "Contact" : "All"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <p className="text-slate-600 dark:text-slate-400">
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
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {runningAgent ? "Running…" : "Run agent worker"}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {leads.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
            <DocumentTextIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              {sourceFilter === "contact" ? "No contact leads yet." : sourceFilter === "all" ? "No leads yet." : "No website request leads yet."}
            </p>
          </div>
        ) : (
          leads.map((lead) => {
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
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                      {(form.name || contactPayload.name || lead.name) as string || "—"}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{lead.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {lead.source === "contact"
                        ? `${(contactPayload.company as string) || ""} · ${lead.agentStatus ?? "pending"} · ${new Date(lead.createdAt).toLocaleString()}`
                        : `${form.company as string || ""} · ${form.tier as string || "starter"} · ${lead.status} · ${new Date(lead.createdAt).toLocaleString()}`}
                    </p>
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Preview: {previewUrl}
                      </a>
                    )}
                    {productionUrl && (
                      <a
                        href={productionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                    >
                      <DocumentTextIcon className="h-4 w-4" />
                      Regenerate package
                    </button>
                    <button
                      onClick={() => runAction(lead.id, "deploy")}
                      disabled={isActioning}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 px-3 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 disabled:opacity-50"
                    >
                      <CloudArrowUpIcon className="h-4 w-4" />
                      Regenerate preview
                    </button>
                    <button
                      onClick={() => runAction(lead.id, "publish")}
                      disabled={isActioning}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 disabled:opacity-50"
                    >
                      <RocketLaunchIcon className="h-4 w-4" />
                      Publish
                    </button>
                  </div>
                  )}
                </div>
                {lead.source !== "contact" && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                  <button
                    onClick={() => setExpandedAi(showAiOutput ? null : lead.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
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
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    {Object.values(WEBSITE_BUILD_TIERS).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                )}
                {showAiOutput && aiPackage && (
                  <pre className="mt-2 p-4 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs overflow-auto max-h-64">
                    {JSON.stringify(aiPackage, null, 2)}
                  </pre>
                )}
                {typeof form.message === "string" && form.message && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Message</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{form.message}</p>
                  </div>
                )}
                {lead.source === "contact" && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-slate-500 dark:text-slate-400">Agent:</span>
                      <span className={`font-semibold ${
                        lead.agentStatus === "RESOLVED" ? "text-emerald-600 dark:text-emerald-400" :
                        lead.agentStatus === "NEEDS_INFO" ? "text-amber-600 dark:text-amber-400" :
                        lead.agentStatus === "ESCALATED" ? "text-rose-600 dark:text-rose-400" :
                        "text-slate-600 dark:text-slate-400"
                      }`}>
                        {lead.agentStatus ?? "pending"}
                      </span>
                    </div>
                    {lead.actionsTaken && lead.actionsTaken.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Actions taken</p>
                        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                          {lead.actionsTaken.map((a, i) => (
                            <li key={i}>• {a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lead.lastEmailSent && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <EnvelopeIcon className="h-4 w-4" />
                        <span>Last email: {lead.lastEmailSent.subject} ({new Date(lead.lastEmailSent.sentAt).toLocaleString()})</span>
                      </div>
                    )}
                    {lead.executionLogIds && lead.executionLogIds.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <CpuChipIcon className="h-4 w-4 text-slate-500" />
                        <span>Execution logs: {lead.executionLogIds.join(", ")}</span>
                      </div>
                    )}
                    {typeof contactPayload.message === "string" && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Message</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{contactPayload.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
