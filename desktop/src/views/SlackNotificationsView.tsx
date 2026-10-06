import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Slack notifications — Phase 517 desktop sibling.
 *
 * Operator configures the org's Slack incoming webhook and which AGI
 * signal kinds to route. Recent delivery log shows what was actually
 * sent (or skipped, or errored). Mirrors /dashboard/slack-notifications.
 */

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
  skipped_not_configured:  "bg-white/15 text-zinc-300 border-white/25",
  skipped_filtered:        "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  error:                   "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:                 "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function SlackNotificationsView() {
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
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Slack notifications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Critical AGI signals → your org's Slack incoming webhook. Best-effort send · every dispatch logged.
        </p>
      </div>

      <ConfigPanel current={configData?.config ?? null} onSaved={loadAll} />

      {logData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Total"   value={String(logData.summary.total)} />
          <Stat label="Sent"    value={String(logData.summary.sent)}    tone={logData.summary.sent > 0 ? "emerald" : "zinc"} />
          <Stat label="Errored" value={String(logData.summary.errored)} tone={logData.summary.errored > 0 ? "rose" : "zinc"} />
          <Stat label="Skipped" value={String(logData.summary.skipped)} tone={logData.summary.skipped > 0 ? "amber" : "zinc"} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading Slack config + log…</div>}
      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-white/30">
          <p className="text-sm font-semibold text-zinc-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-zinc-300 border border-white/20">Sign in required.</div>
      )}

      {logData && (
        logData.entries.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No Slack deliveries yet. Configure a webhook above, then run an AGI engine that emits a critical signal.
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
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
        )
      )}
    </ViewShell>
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
        setWebhookUrl("");
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
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">Slack incoming webhook</p>
        {currentlyConfigured && (
          <span className="text-[10px] font-mono text-emerald-300">
            current: {current!.webhookUrl} {current!.enabled ? "(enabled)" : "(disabled)"}
          </span>
        )}
      </div>
      <label className="block mb-2">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
          {currentlyConfigured ? "Update webhook URL (leave blank to keep current)" : "Webhook URL (https://hooks.slack.com/services/...)"}
        </span>
        <input
          type="text"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/T.../B.../..."
          disabled={busy}
          className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
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
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
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
            <label key={k} className="flex items-center gap-2 text-[11.5px] text-zinc-300 cursor-pointer rounded border border-zinc-700/40 bg-zinc-900/40 px-2 py-1.5">
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
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Saving…" : "Save config"}
        </button>
        {ok && <span className="text-[11.5px] font-mono text-emerald-300">✓ saved</span>}
        {err && <span className="text-[11.5px] font-mono text-rose-300">✗ {err}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-white/20 text-zinc-200",
    rose:    "border-rose-500/20 text-rose-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
