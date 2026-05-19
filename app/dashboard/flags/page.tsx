"use client";

/**
 * /dashboard/flags — per-tenant feature flag editor.
 *
 * Lists every flag in the closed catalog with current effective
 * value + override status. Toggling a flag writes a TenantFeatureFlag
 * row; clearing the override restores the catalog default.
 */

import { useEffect, useMemo, useState } from "react";
import {
  PuzzlePieceIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type Group = "autonomy" | "notifications" | "audit" | "ui";

interface Spec {
  key: string;
  label: string;
  description: string;
  default: boolean;
  group: Group;
}

interface FlagRecord {
  key: string;
  spec: Spec;
  enabled: boolean;
  hasOverride: boolean;
  rationale?: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface Report {
  records: FlagRecord[];
  total: number;
  overrideCount: number;
}

const GROUP_LABEL: Record<Group, string> = {
  autonomy: "Autonomy",
  notifications: "Notifications",
  audit: "Audit",
  ui: "Interface",
};

export default function FlagsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rationales, setRationales] = useState<Record<string, string>>({});

  function load() {
    setError(null);
    fetch("/api/flags", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Flags unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."));
  }

  useEffect(() => { load(); }, []);

  async function toggle(rec: FlagRecord) {
    setBusy(rec.key);
    try {
      await fetch("/api/flags", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: rec.key,
          enabled: !rec.enabled,
          rationale: rationales[rec.key]?.trim() || undefined,
        }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function clearOverride(rec: FlagRecord) {
    setBusy(rec.key);
    try {
      await fetch("/api/flags", {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: rec.key }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  const grouped = useMemo(() => {
    const m: Record<Group, FlagRecord[]> = { autonomy: [], notifications: [], audit: [], ui: [] };
    for (const r of report?.records ?? []) {
      m[r.spec.group as Group].push(r);
    }
    return m;
  }, [report]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(168,85,247,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(34,211,238,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <PuzzlePieceIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Feature Flags · policy_governance_read_only
            </span>
          </span>
          <button
            onClick={load}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white"
          >
            <ArrowPathIcon className="h-3 w-3" />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Per-tenant <span className="text-gradient">flags.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Toggle a flag to enable / disable a behavior for this tenant. Clearing the override restores the
          catalog default. Every change captures who toggled it + an optional rationale.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Total flags" value={String(report.total)} tone="violet" />
            <Stat label="Overrides set" value={String(report.overrideCount)} tone={report.overrideCount > 0 ? "amber" : "emerald"} />
            <Stat label="Defaults active" value={String(report.total - report.overrideCount)} tone="emerald" />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {report && (Object.keys(grouped) as Group[]).map((g) => (
        grouped[g].length > 0 && (
          <div key={g} className="mb-6">
            <p className="text-[11px] font-mono text-violet-300/80 uppercase tracking-[0.18em] mb-2">
              // {GROUP_LABEL[g]} · {grouped[g].length}
            </p>
            <div className="space-y-2">
              {grouped[g].map((rec) => (
                <div key={rec.key} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-[13px] font-semibold text-white">{rec.spec.label}</p>
                        <code className="text-[10px] font-mono text-zinc-500">{rec.key}</code>
                        {rec.hasOverride && (
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30">
                            override
                          </span>
                        )}
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          rec.enabled
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                        }`}>
                          {rec.enabled ? "enabled" : "disabled"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{rec.spec.description}</p>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1">
                        catalog default: {String(rec.spec.default)}
                        {rec.updatedBy && ` · last set by ${rec.updatedBy}`}
                        {rec.updatedAt && ` · ${new Date(rec.updatedAt).toLocaleString()}`}
                      </p>
                      {rec.rationale && (
                        <p className="text-[10px] text-zinc-400 italic mt-1">"{rec.rationale}"</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <input
                        value={rationales[rec.key] ?? ""}
                        onChange={(e) => setRationales((m) => ({ ...m, [rec.key]: e.target.value }))}
                        placeholder="optional rationale"
                        className="w-48 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[10px] font-mono text-zinc-200 focus:border-violet-400/60 focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggle(rec)}
                          disabled={busy === rec.key}
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border ${
                            rec.enabled
                              ? "bg-zinc-500/15 text-zinc-300 border-zinc-500/30 hover:bg-zinc-500/20"
                              : "bg-emerald-500/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/20"
                          } disabled:opacity-50`}
                        >
                          {rec.enabled ? <XCircleIcon className="h-3 w-3" /> : <CheckCircleIcon className="h-3 w-3" />}
                          {rec.enabled ? "Disable" : "Enable"}
                        </button>
                        {rec.hasOverride && (
                          <button
                            onClick={() => clearOverride(rec)}
                            disabled={busy === rec.key}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/15 disabled:opacity-50"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "violet" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[18px] font-bold mt-1">{value}</p>
    </div>
  );
}
