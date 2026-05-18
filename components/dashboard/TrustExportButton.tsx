"use client";

/**
 * TrustExportButton — Trust Center evidence export CTA.
 *
 * Calls POST /api/trust/export with { kind, format } and downloads the
 * canonical serialized bundle as an attachment. Operators can hand the
 * file to an auditor without leaving the app.
 *
 * Read-only: the export endpoint reads control + evidence + audit data
 * tenant-scoped. No mutation. Audit event recorded server-side.
 */

import { useState } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

type Phase = "idle" | "running" | "done" | "error";

type BundleKind =
  | "security_review"
  | "aws_connection"
  | "github_releaseops"
  | "desktop_security"
  | "execution_approval"
  | "audit_trail"
  | "ai_safety"
  | "tenant_isolation"
  | "release_distribution";

type BundleFormat = "json" | "ndjson";

const KIND_LABEL: Record<BundleKind, string> = {
  security_review:      "Security review",
  aws_connection:       "AWS connection",
  github_releaseops:    "GitHub / ReleaseOps",
  desktop_security:     "Desktop security",
  execution_approval:   "Execution approvals",
  audit_trail:          "Audit trail",
  ai_safety:            "AI safety",
  tenant_isolation:     "Tenant isolation",
  release_distribution: "Release distribution",
};

interface ExportResultLite {
  kind: string;
  format: string;
  generatedAt: string;
  serialized: string;
  bundle?: { summary?: { totalRecords?: number; verifiedRecords?: number } };
}

export function TrustExportButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [kind, setKind] = useState<BundleKind>("security_review");
  const [format, setFormat] = useState<BundleFormat>("json");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExportResultLite | null>(null);

  const runExport = async () => {
    setPhase("running");
    setError(null);
    try {
      const res = await fetch("/api/trust/export", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, format }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: ExportResultLite; error?: { userMessage?: string } };
      if (!json.ok || !json.data) {
        setError(json.error?.userMessage ?? `Export failed (HTTP ${res.status}).`);
        setPhase("error");
        return;
      }

      // Trigger browser download of the serialized bundle.
      const mime = format === "ndjson" ? "application/x-ndjson" : "application/json";
      const blob = new Blob([json.data.serialized], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `axiom-trust-${kind}-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastResult(json.data);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("error");
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// audit-ready evidence export</p>
          <h3 className="text-base font-semibold text-white tracking-tight">Hand evidence to an auditor</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-0.5">
            Tenant-scoped bundle. Read-only. Includes control statuses, evidence records, audit events, traces, and limitations.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Bundle kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as BundleKind)}
            disabled={phase === "running"}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] text-[13px] text-zinc-200 px-3 py-2 focus:outline-none focus:border-emerald-500/40"
          >
            {(Object.keys(KIND_LABEL) as BundleKind[]).map((k) => (
              <option key={k} value={k} className="bg-zinc-900">{KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as BundleFormat)}
            disabled={phase === "running"}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] text-[13px] text-zinc-200 px-3 py-2 focus:outline-none focus:border-emerald-500/40"
          >
            <option value="json"   className="bg-zinc-900">JSON</option>
            <option value="ndjson" className="bg-zinc-900">NDJSON</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={runExport}
          disabled={phase === "running"}
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-all ${
            phase === "running"
              ? "border-white/[0.08] bg-white/[0.02] text-zinc-400 cursor-wait"
              : "border-emerald-500/40 bg-emerald-500/[0.12] text-emerald-100 hover:border-emerald-500/60 hover:bg-emerald-500/[0.18]"
          }`}
        >
          {phase === "running" ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Building bundle…
            </>
          ) : (
            <>
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download {format.toUpperCase()} bundle
            </>
          )}
        </button>

        {phase === "done" && lastResult && (
          <div className="inline-flex items-center gap-2 text-[12px] text-emerald-200">
            <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
            <span>
              Bundle saved · {lastResult.bundle?.summary?.totalRecords ?? "—"} records · generated {new Date(lastResult.generatedAt).toLocaleTimeString()}
            </span>
          </div>
        )}

        {phase === "error" && (
          <div className="inline-flex items-center gap-2 text-[12px] text-rose-200">
            <ExclamationTriangleIcon className="h-4 w-4 text-rose-300 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
