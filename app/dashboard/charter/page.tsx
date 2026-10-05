"use client";

/**
 * /dashboard/charter — per-tenant autonomy charter override editor.
 *
 * Reads /api/autonomy/charter. Operators pick a mode (observer /
 * review / assisted / autonomous), optionally override the per-cycle
 * action cap and the Slack webhook for this tenant, and save.
 */

import { useEffect, useState } from "react";
import { CpuChipIcon, CheckIcon, TrashIcon } from "@heroicons/react/24/outline";

type Mode = "observer" | "review" | "assisted" | "autonomous";

interface Record {
  organizationId: string;
  mode: Mode;
  perCycleActionLimit?: number;
  rationale?: string;
  slackWebhookOverride?: string;
  updatedAt: string;
  updatedBy?: string;
  resolved: {
    mode: Mode;
    perCycleActionLimit: number;
    rationale: string;
    allowedClasses: string[];
  };
}

const MODES: { mode: Mode; tagline: string; tone: string }[] = [
  { mode: "observer",   tagline: "Loop runs but never auto-approves. Operator drives every transition.", tone: "border-zinc-500/30 bg-zinc-500/[0.04]" },
  { mode: "review",     tagline: "Auto-approves read-only / preview / simulation; halts everything else for review.", tone: "border-sky-500/30 bg-sky-500/[0.04]" },
  { mode: "assisted",   tagline: "Also hands desktop-reviewable actions to the paired runtime. Mutations halt.", tone: "border-white/[0.12] bg-white/[0.015]" },
  { mode: "autonomous", tagline: "Drives policy-gated executions end-to-end. Unsafe + credential-disabled classes always halt.", tone: "border-emerald-500/30 bg-emerald-500/[0.04]" },
];

export default function CharterPage() {
  const [record, setRecord] = useState<Record | null>(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [mode, setMode] = useState<Mode>("observer");
  const [perCycle, setPerCycle] = useState<string>("");
  const [rationale, setRationale] = useState<string>("");
  const [slackWebhook, setSlackWebhook] = useState<string>("");

  function applyRecord(r: Record | null, has: boolean) {
    setRecord(r);
    setHasOverride(has);
    if (r) {
      setMode(r.mode);
      setPerCycle(r.perCycleActionLimit ? String(r.perCycleActionLimit) : "");
      setRationale(r.rationale ?? "");
      setSlackWebhook(r.slackWebhookOverride ?? "");
    }
  }

  function load() {
    setLoading(true);
    fetch("/api/autonomy/charter", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: { record: Record | null; hasOverride: boolean }; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) applyRecord(j.data.record, j.data.hasOverride);
        else setError(j.error?.userMessage ?? "Charter unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setSavedAt(null);
    try {
      const cap = perCycle.trim() ? Number.parseInt(perCycle, 10) : undefined;
      const r = await fetch("/api/autonomy/charter", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          perCycleActionLimit: Number.isFinite(cap) ? cap : undefined,
          rationale: rationale || undefined,
          slackWebhookOverride: slackWebhook || undefined,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; data?: { record: Record }; error?: { userMessage?: string } };
      if (j.ok && j.data) {
        applyRecord(j.data.record, true);
        setSavedAt(new Date().toLocaleTimeString());
      } else {
        setError(j.error?.userMessage ?? "Save failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function clearOverride() {
    setBusy(true);
    try {
      await fetch("/api/autonomy/charter", { method: "DELETE", credentials: "include" });
      applyRecord(null, false);
      setMode("observer");
      setPerCycle("");
      setRationale("");
      setSlackWebhook("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(168,85,247,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(16,185,129,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CpuChipIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Autonomy charter
            </span>
          </span>
          {savedAt && <span className="text-[10px] font-mono text-emerald-300">saved {savedAt}</span>}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Tune the <span className="text-gradient">autonomy gate.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Choose how aggressive the AGI loop is for this tenant. Mode picks the default boundary classes;
          per-cycle cap clamps how many candidate actions per cron tick. Unsafe classes always halt regardless.
        </p>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && (
        <>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <p className="text-[11px] font-mono text-violet-300/80 uppercase tracking-wider mb-3">Autonomy mode</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.mode}
                  onClick={() => setMode(m.mode)}
                  className={`text-left rounded-lg border p-3 transition ${
                    mode === m.mode
                      ? `${m.tone} ring-2 ring-violet-400/40`
                      : "border-white/[0.06] bg-black/20 hover:border-white/[0.18]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[13px] font-semibold text-white capitalize">{m.mode}</p>
                    {mode === m.mode && <CheckIcon className="h-4 w-4 text-violet-300" />}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">{m.tagline}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Per-cycle action limit (1–50)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={perCycle}
                onChange={(e) => setPerCycle(e.target.value)}
                placeholder="defaults to mode preset"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-white focus:border-violet-400/60 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Slack webhook override (optional)
              </label>
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/..."
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] font-mono text-white focus:border-violet-400/60 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Rationale (audit log)
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
                placeholder="Why are you setting this mode? (1000 chars max)"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-white focus:border-violet-400/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-8 flex-wrap">
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-white border border-white/[0.12] hover:bg-violet-500/20 disabled:opacity-50"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              {busy ? "Saving…" : hasOverride ? "Update charter" : "Save charter"}
            </button>
            {hasOverride && (
              <button
                onClick={clearOverride}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/15 disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Clear override
              </button>
            )}
            {record && (
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                {hasOverride ? `last updated ${new Date(record.updatedAt).toLocaleString()}` : "no override · global observer default in force"}
              </span>
            )}
          </div>

          {record && (
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
              <p className="text-[10px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-2">// resolved charter</p>
              <p className="text-[13px] text-emerald-100"><strong>Mode:</strong> {record.resolved.mode}</p>
              <p className="text-[13px] text-emerald-100"><strong>Per-cycle limit:</strong> {record.resolved.perCycleActionLimit}</p>
              <p className="text-[12px] text-zinc-300 mt-1">{record.resolved.rationale}</p>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {record.resolved.allowedClasses.map((c) => (
                  <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-200 border-emerald-500/20">{c}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
