"use client";

/**
 * /dashboard/slack-notifications — Phase 517.
 *
 * Operator configures the org's Slack incoming webhook and which AGI
 * signal kinds to route. Recent delivery log shows what was actually
 * sent (or skipped, or errored).
 */

import { useEffect, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

const SIGNAL_KINDS = ["council_critical", "triage_auto_escalate", "learning_loop_signal", "remediation_p0", "proactive_suggestion_batch"] as const;
type SignalKind = (typeof SIGNAL_KINDS)[number];
type Outcome = "sent" | "skipped_not_configured" | "skipped_filtered" | "error" | "unknown";

interface ConfigView {
  webhookUrl: string;
  enabled: boolean;
  enabledSignalKinds: SignalKind[] | null;
  defaultChannel: string | null;
}

interface LogEntry {
  id: string;
  signalKind: string;
  subjectKind: string | null;
  subjectId: string | null;
  title: string;
  outcome: Outcome;
  httpStatus: number | null;
  errorMessage: string | null;
  generatedAtIso: string;
}

interface LogData {
  generatedAt: string;
  entries: LogEntry[];
  summary: { total: number; sent: number; errored: number; skipped: number };
}

type ConfigBody = { ok: true; data: { config: ConfigView | null } } | { ok: false; error: string; hint?: string };
type LogBody = { ok: true; data: LogData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<string, string> = {
  council_critical: "Council critical",
  triage_auto_escalate: "Triage auto-escalate",
  learning_loop_signal: "Learning loop",
  remediation_p0: "Remediation P0",
  proactive_suggestion_batch: "AGI suggestions",
};

const OUTCOME_CLASS: Record<Outcome, string> = {
  sent:                    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  skipped_not_configured:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  skipped_filtered:        "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  error:                   "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:                 "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function SlackNotificationsPage() {
  const [configResp, setConfigResp] = useState<ConfigBody | null>(null);
  const [logResp, setLogResp] = useState<LogBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    setNetworkError(null);
    Promise.all([
      fetch("/api/dashboard/slack-config", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/dashboard/slack-log-list", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([c, l]) => { setConfigResp(c); setLogResp(l); })
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAll(); }, []);

  const configData = configResp?.ok ? configResp.data : null;
  const logData = logResp?.ok ? logResp.data : null;
  const errorBody = (configResp && !configResp.ok ? configResp : null) ?? (logResp && !logResp.ok ? logResp : null);

  return (
    <div className="relative">
      <PageIntro
        kicker={`AGI cockpit · slack outbound${logData ? ` · ${logData.summary.sent} sent` : ""}`}
        title={<>Critical signals <span className="text-zinc-500">arrive in Slack.</span></>}
        description="When the AGI council emits a critical consensus (block_deploy / rollback), a triage auto-escalates, the learning loop surfaces a high-strength signal, or remediation proposes a P0 action, the platform sends to your org's Slack incoming webhook. Filter which kinds you want by toggling them below. Best-effort delivery — Slack never blocks the source action."
        helps="Paste your Slack incoming webhook URL, pick which signals to route, click Save. The delivery log below shows every outbound + skip + error."
        connectFirst="Slack: Settings → Integrations → Create new incoming webhook → copy URL here."
        engineers={["On-call", "Platform team", "AI Operations"]}
        requiresApproval="No write actions to Slack — incoming webhooks only. Outbound payloads are formatted with severity emoji + dashboard deep-link."
        actions={[
          { label: "Open AGI cockpit", href: "/dashboard/agi-cockpit" },
          { label: "Open advisor council", href: "/dashboard/advisor-council" },
        ]}
        safetyNote="Webhook URL masked on read · best-effort send · every dispatch logged · errors never break the source AGI action"
      />

      <ConfigPanel current={configData?.config ?? null} onSaved={loadAll} />

      {logData && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={ChatBubbleLeftRightIcon} label="Total" value={String(logData.summary.total)} tone="zinc" />
          <Stat icon={CheckCircleIcon} label="Sent" value={String(logData.summary.sent)} tone={logData.summary.sent > 0 ? "emerald" : "zinc"} />
          <Stat icon={XCircleIcon} label="Errored" value={String(logData.summary.errored)} tone={logData.summary.errored > 0 ? "rose" : "zinc"} />
          <Stat icon={ExclamationTriangleIcon} label="Skipped" value={String(logData.summary.skipped)} tone={logData.summary.skipped > 0 ? "amber" : "zinc"} />
        </div>
      )}

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">Loading Slack config + log…</div>}
      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {logData && logData.entries.length > 0 && (
        <>
          <h2 className="text-[13px] font-semibold text-white mb-3">Recent deliveries</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <table className="w-full text-[11.5px] font-mono">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">When</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Kind</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Title</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Outcome</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">HTTP</th>
                </tr>
              </thead>
              <tbody>
                {logData.entries.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-3 py-1.5 text-zinc-300">{new Date(e.generatedAtIso).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-zinc-200">{KIND_LABEL[e.signalKind] ?? e.signalKind}</td>
                    <td className="px-3 py-1.5 text-zinc-200">{e.title}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider ${OUTCOME_CLASS[e.outcome]}`}>
                        {e.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-zinc-400">{e.httpStatus ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ConfigPanel({ current, onSaved }: { current: ConfigView | null; onSaved: () => void }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [defaultChannel, setDefaultChannel] = useState(current?.defaultChannel ?? "");
  const [enabled, setEnabled] = useState(current?.enabled !== false);
  const [kindsState, setKindsState] = useState<Record<SignalKind, boolean>>({
    council_critical: true,
    triage_auto_escalate: true,
    learning_loop_signal: true,
    remediation_p0: true,
    proactive_suggestion_batch: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (current) {
      setDefaultChannel(current.defaultChannel ?? "");
      setEnabled(current.enabled);
      if (current.enabledSignalKinds && current.enabledSignalKinds.length > 0) {
        const next: Record<SignalKind, boolean> = {
          council_critical: false,
          triage_auto_escalate: false,
          learning_loop_signal: false,
          remediation_p0: false,
          proactive_suggestion_batch: false,
        };
        for (const k of current.enabledSignalKinds) next[k] = true;
        setKindsState(next);
      }
    }
  }, [current]);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const enabledSignalKinds = SIGNAL_KINDS.filter((k) => kindsState[k]);
      const res = await fetch("/api/dashboard/slack-config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          enabledSignalKinds,
          ...(defaultChannel ? { defaultChannel } : {}),
          enabled,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setOk(true);
        setWebhookUrl(""); // wipe local URL after save
        onSaved();
      } else {
        setErr(j.hint ?? j.error);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  const currentlyConfigured = current !== null && current.webhookUrl.length > 0;

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">Slack incoming webhook</p>
        {currentlyConfigured && (
          <span className="text-[10px] font-mono text-emerald-300">
            current: {current!.webhookUrl} {current!.enabled ? "(enabled)" : "(disabled)"}
          </span>
        )}
      </div>
      <label className="block mb-3">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
          {currentlyConfigured ? "Update webhook URL (leave blank to keep current)" : "Webhook URL (https://hooks.slack.com/services/...)"}
        </span>
        <input
          type="text"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/T.../B.../..."
          disabled={busy}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Default channel (informational)</span>
          <input
            type="text"
            value={defaultChannel}
            onChange={(e) => setDefaultChannel(e.target.value)}
            placeholder="#deploys"
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer pt-5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
            className="accent-violet-500 disabled:opacity-50"
          />
          <span>Enabled (uncheck to pause outbound)</span>
        </label>
      </div>
      <div className="mb-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">Signal kinds to route</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SIGNAL_KINDS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-[11.5px] text-zinc-300 cursor-pointer rounded border border-white/[0.06] bg-black/20 px-2 py-1.5">
              <input
                type="checkbox"
                checked={kindsState[k]}
                onChange={(e) => setKindsState((s) => ({ ...s, [k]: e.target.checked }))}
                disabled={busy}
                className="accent-violet-500"
              />
              <span>{KIND_LABEL[k]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || (!webhookUrl && !currentlyConfigured)}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Saving…" : "Save config"}
        </button>
        {ok && <span className="text-[11.5px] font-mono text-emerald-300">✓ saved</span>}
        {err && <span className="text-[11.5px] font-mono text-rose-300">✗ {err}</span>}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ChatBubbleLeftRightIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
