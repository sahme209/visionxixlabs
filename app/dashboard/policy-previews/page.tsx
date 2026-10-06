"use client";

/**
 * /dashboard/policy-previews — ready-to-paste guardrail policies.
 *
 * Each runbook gets a per-cloud policy package (SCP / Azure Policy /
 * GCP Org Policy). Operators copy the JSON, paste into their IaC
 * stack, and apply themselves. Axiom never attaches the policy.
 */

import { useCallback, useEffect, useState } from "react";
import {
  LockClosedIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ClockIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

type Cloud = "aws" | "azure" | "gcp";

interface Preview {
  cloud: Cloud;
  label: string;
  description: string;
  policyJson: string;
  applyHint: string;
}

interface PolicyPackage {
  runbookId: string;
  eventName: string;
  severity: string;
  hardeningLabel: string;
  previews: Preview[];
  notes: string[];
}

interface Report {
  generatedAt: string;
  lookbackMinutes: number;
  totalRunbooks: number;
  totalPackages: number;
  totalPreviews: number;
  packages: PolicyPackage[];
  durationMs: number;
  limitations: string[];
}

const CLOUD_LABEL: Record<Cloud, string> = { aws: "AWS SCP", azure: "Azure Policy", gcp: "GCP Org Policy" };
const CLOUD_TONE: Record<Cloud, string> = {
  aws: "border-amber-500/30 bg-amber-500/[0.04]",
  azure: "border-sky-500/30 bg-sky-500/[0.04]",
  gcp: "border-emerald-500/30 bg-emerald-500/[0.04]",
};

const LOOKBACK_OPTIONS = [
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

export default function PolicyPreviewsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookback, setLookback] = useState(360);
  const [copied, setCopied] = useState<string | null>(null);
  const [tfDraft, setTfDraft] = useState<{ key: string; hcl: string; applyHint: string; warnings: string[] } | null>(null);
  const [tfBusy, setTfBusy] = useState<string | null>(null);

  const load = useCallback((minutes: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/autonomy/policy-previews?lookbackMinutes=${minutes}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Policy previews unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(lookback); }, [lookback, load]);

  function copyOne(key: string, json: string) {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  async function draftTf(key: string, cloud: Cloud, label: string, policyJson: string) {
    setTfBusy(key);
    try {
      const r = await fetch("/api/autonomy/terraform-draft", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cloud, label, policyJson }),
      });
      const j = (await r.json()) as { ok?: boolean; data?: { hcl: string; applyHint: string; warnings: string[] } };
      if (j.ok && j.data) {
        setTfDraft({ key, hcl: j.data.hcl, applyHint: j.data.applyHint, warnings: j.data.warnings });
      }
    } finally {
      setTfBusy(null);
    }
  }

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(34,197,94,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(124,58,237,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <LockClosedIcon className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Policy Previews · approval_only_no_execution
            </span>
          </span>
          {report && (
            <span className="text-[10px] font-mono text-zinc-500">{report.durationMs}ms</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          One-click <span className="text-gradient">guardrails.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every runbook's hardening action becomes ready-to-paste SCP / Azure Policy / GCP Org Policy JSON.
          Copy, paste into your IaC stack, apply. Axiom never attaches a policy directly.
        </p>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <ClockIcon className="h-4 w-4 text-zinc-500" />
          {LOOKBACK_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLookback(o.value)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                lookback === o.value
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
          <button
            onClick={() => load(lookback)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Runbooks scanned" value={String(report.totalRunbooks)} tone="zinc" />
            <Stat label="Policy packages" value={String(report.totalPackages)} tone="violet" icon={LockClosedIcon} />
            <Stat label="Total previews" value={String(report.totalPreviews)} tone="emerald" />
            <Stat label="Lookback" value={`${report.lookbackMinutes}m`} tone="zinc" />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // generating SCP + Azure Policy + GCP Org Policy previews…
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <>
          {report.packages.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No runbooks in this window — no policy previews to draft.
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {report.packages.map((pkg) => (
                <div key={pkg.runbookId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-violet-500/15 text-violet-300 border-white/[0.12]">
                      {pkg.severity}
                    </span>
                    <p className="text-[14px] font-semibold text-white">{pkg.eventName}</p>
                    <span className="text-[10px] font-mono text-zinc-500">→ {pkg.hardeningLabel}</span>
                  </div>

                  {pkg.previews.length === 0 && pkg.notes.length > 0 && (
                    <div className="rounded-md border border-amber-500/15 bg-amber-500/[0.04] p-2.5">
                      {pkg.notes.map((n, i) => (
                        <p key={i} className="text-[11px] text-amber-200">{n}</p>
                      ))}
                    </div>
                  )}

                  {pkg.previews.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                      {pkg.previews.map((p) => {
                        const key = `${pkg.runbookId}:${p.cloud}`;
                        return (
                          <div key={p.cloud} className={`rounded-lg border ${CLOUD_TONE[p.cloud]} p-3 flex flex-col`}>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[10px] font-mono text-white/80 uppercase tracking-wider">
                                {CLOUD_LABEL[p.cloud]}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => draftTf(key, p.cloud, p.label, p.policyJson)}
                                  disabled={tfBusy === key}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-black/30 border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-50"
                                >
                                  {tfBusy === key ? "…" : "tf"}
                                </button>
                                <button
                                  onClick={() => copyOne(key, p.policyJson)}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-black/30 border-white/[0.08] text-zinc-300 hover:text-white"
                                >
                                  {copied === key ? (
                                    <>
                                      <CheckIcon className="h-3 w-3 text-emerald-300" />
                                      copied
                                    </>
                                  ) : (
                                    <>
                                      <ClipboardDocumentIcon className="h-3 w-3" />
                                      copy
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                            <p className="text-[12px] font-semibold text-white">{p.label}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{p.description}</p>
                            <pre className="mt-2 max-h-44 overflow-auto rounded border border-white/[0.08] bg-black/40 p-2 text-[10px] font-mono text-zinc-200 leading-snug">
                              {p.policyJson}
                            </pre>
                            <p className="mt-2 text-[10px] font-mono text-zinc-500 leading-snug">{p.applyHint}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {report.limitations.length > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-4 mb-8">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">// notes</p>
              {report.limitations.map((l, i) => <p key={i} className="text-[12px] text-zinc-300">· {l}</p>)}
            </div>
          )}

          {tfDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setTfDraft(null)}>
              <div onClick={(e) => e.stopPropagation()} className="max-w-3xl w-full rounded-2xl border border-white/[0.1] bg-zinc-950 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-mono text-violet-300 uppercase tracking-wider">// terraform draft · {tfDraft.key}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(tfDraft.hcl)}
                      className="text-[11px] font-mono px-2 py-1 rounded border bg-black/30 border-white/[0.08] text-zinc-200 hover:text-white"
                    >
                      copy HCL
                    </button>
                    <button onClick={() => setTfDraft(null)} className="text-[11px] font-mono px-2 py-1 rounded border bg-black/30 border-white/[0.08] text-zinc-200 hover:text-white">
                      close
                    </button>
                  </div>
                </div>
                <pre className="max-h-[55vh] overflow-auto rounded-lg border border-white/[0.08] bg-black/60 p-3 text-[11px] font-mono text-emerald-100 leading-relaxed">
{tfDraft.hcl}
                </pre>
                <p className="text-[11px] text-zinc-400 mt-2 leading-snug">{tfDraft.applyHint}</p>
                {tfDraft.warnings.length > 0 && (
                  <div className="mt-2 rounded border border-amber-500/15 bg-amber-500/[0.04] p-2">
                    {tfDraft.warnings.map((w, i) => (
                      <p key={i} className="text-[10px] text-amber-200">· {w}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "violet" | "zinc"; icon?: typeof LockClosedIcon }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    violet:  "border-white/[0.06] bg-white/[0.015] text-white",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
