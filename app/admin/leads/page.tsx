"use client";

import { useState, useEffect } from "react";
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  RocketLaunchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { WEBSITE_BUILD_TIERS } from "@/lib/websiteBuildPricing";

type Lead = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  fullPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedAi, setExpandedAi] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const loadLeads = () =>
    fetch("/api/leads/list")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadLeads();
  }, []);

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
        Website request leads
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        New Website Request submissions. Use buttons to regenerate AI package, preview, or publish.
      </p>

      <div className="space-y-4">
        {leads.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
            <DocumentTextIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No website request leads yet.</p>
          </div>
        ) : (
          leads.map((lead) => {
            const payload = lead.fullPayload || {};
            const form = (payload.form as Record<string, unknown>) || {};
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
                      {form.name as string || lead.name || "—"}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{lead.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {form.company as string || ""} · {form.tier as string || "starter"} · {lead.status} · {new Date(lead.createdAt).toLocaleString()}
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
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                  <button
                    onClick={() => setExpandedAi(showAiOutput ? null : lead.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    {showAiOutput ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                    View AI output
                  </button>
                  <select
                    value={(form.tier as string) || "starter"}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
