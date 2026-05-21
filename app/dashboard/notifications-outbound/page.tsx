"use client";

/**
 * /dashboard/notifications-outbound — outbound notification posture.
 *
 * Shows which channels are wired (Slack / Teams / generic webhook /
 * email), and lets the operator fire a synthetic test through every
 * configured channel to verify delivery. Also has a "dispatch
 * telemetry" button that fans every high+critical signal out through
 * Slack/Teams (deduped per signal id).
 */

import { useEffect, useState } from "react";
import {
  BellAlertIcon,
  ShieldCheckIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

type Channel = "slack" | "microsoft_teams" | "generic_webhook" | "email";

interface ChannelPosture {
  channel: Channel;
  configured: boolean;
  signed?: boolean;
  hint: string;
}

interface OutboundStatus {
  channels: ChannelPosture[];
  configuredCount: number;
  generatedAt: string;
}

interface SendResult {
  ok: boolean;
  channelsAttempted: Channel[];
  channelsSucceeded: Channel[];
  channelsSkipped: { channel: Channel; reason: string }[];
  reason?: string;
  durationMs: number;
}

interface HistoryRow {
  id: string;
  dedupeKey: string;
  kind: string;
  severity: string;
  headline: string;
  outcome: string;
  channelsSucceeded: string[];
  channelsSkipped: string[];
  createdAt: string;
}
interface HistoryReport {
  totalRows: number;
  rows: HistoryRow[];
  perOutcome: Record<string, number>;
  perSeverity: Record<string, number>;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  slack: "Slack",
  microsoft_teams: "Microsoft Teams",
  generic_webhook: "Generic webhook",
  email: "Email",
};

const CHANNEL_ICON: Record<Channel, typeof BellAlertIcon> = {
  slack: ChatBubbleLeftRightIcon,
  microsoft_teams: ChatBubbleLeftRightIcon,
  generic_webhook: CodeBracketIcon,
  email: EnvelopeIcon,
};

export default function OutboundNotificationsPage() {
  const [status, setStatus] = useState<OutboundStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SendResult | null>(null);
  const [telemetryOutcome, setTelemetryOutcome] = useState<{ totalSignalsInspected: number; totalDispatchAttempted: number; totalDispatchSucceeded: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryReport | null>(null);

  const loadHistory = () => {
    fetch("/api/notifications/history?limit=50", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: HistoryReport }) => {
        if (j.ok && j.data) setHistory(j.data);
      })
      .catch(() => { /* silent — history is optional */ });
  };

  useEffect(() => {
    fetch("/api/notifications/outbound-status", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: OutboundStatus; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setStatus(j.data);
        else setStatusError(j.error?.userMessage ?? "Status unavailable.");
      })
      .catch((err) => setStatusError(err instanceof Error ? err.message : "Network error."));
    loadHistory();
  }, []);

  async function sendTest() {
    setBusy(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/notifications/dispatch-test", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { ok?: boolean; data?: SendResult; error?: { userMessage?: string } };
      if (j.ok && j.data) setTestResult(j.data);
      else setTestResult({ ok: false, channelsAttempted: [], channelsSucceeded: [], channelsSkipped: [], reason: j.error?.userMessage, durationMs: 0 });
      loadHistory();
    } catch (err) {
      setTestResult({ ok: false, channelsAttempted: [], channelsSucceeded: [], channelsSkipped: [], reason: err instanceof Error ? err.message : "Network error.", durationMs: 0 });
    } finally {
      setBusy(false);
    }
  }

  async function dispatchTelemetry() {
    setBusy(true);
    setTelemetryOutcome(null);
    try {
      const r = await fetch("/api/notifications/dispatch-telemetry", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minSeverity: "high" }),
      });
      const j = (await r.json()) as { ok?: boolean; data?: { outcome: typeof telemetryOutcome }; error?: { userMessage?: string } };
      if (j.ok && j.data) setTelemetryOutcome(j.data.outcome);
    } catch {
      // Show generic failure inline.
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
              "radial-gradient(900px 320px at 12% 0%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(124,58,237,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <BellAlertIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Outbound notifications
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          AGI <span className="text-gradient">pages humans</span> back.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Autonomy halts and critical telemetry signals dispatch to Slack, Teams, and signed webhooks — deduped
          per-signal, never spammed. Verify wiring with a one-click test.
        </p>
      </div>

      {statusError && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {statusError}
        </div>
      )}

      {status && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {status.channels.map((c) => {
              const Icon = CHANNEL_ICON[c.channel];
              return (
                <div key={c.channel} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-cyan-300" />
                      <span className="text-[13px] font-semibold text-white">{CHANNEL_LABEL[c.channel]}</span>
                    </div>
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        c.configured
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {c.configured ? "wired" : "missing"}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400">{c.hint}</p>
                  {c.signed !== undefined && (
                    <p className="text-[10px] font-mono text-zinc-500 mt-1">
                      signing: {c.signed ? "HMAC-SHA256 enabled" : "unsigned"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono text-cyan-300/80 uppercase tracking-wider mb-1">// step 1 · verify wiring</p>
                <h2 className="text-[16px] font-semibold text-white mb-1">Send synthetic test</h2>
                <p className="text-[12px] text-zinc-400">
                  Fires a `cycle_summary` notification through every wired channel. Deduped per-day per-tenant.
                </p>
              </div>
              <button
                onClick={sendTest}
                disabled={busy || status.configuredCount === 0}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-3.5 w-3.5" />
                {busy ? "Sending…" : "Send test"}
              </button>
            </div>
            {testResult && (
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  {testResult.ok ? (
                    <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <XCircleIcon className="h-4 w-4 text-rose-300" />
                  )}
                  <span className="text-[12px] font-semibold text-white">
                    {testResult.ok ? "Delivered" : "No channels succeeded"}
                    {testResult.reason ? ` · ${testResult.reason}` : ""}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">{testResult.durationMs}ms</span>
                </div>
                {testResult.channelsSucceeded.length > 0 && (
                  <p className="text-[11px] font-mono text-emerald-300">
                    ✓ {testResult.channelsSucceeded.map((c) => CHANNEL_LABEL[c]).join(", ")}
                  </p>
                )}
                {testResult.channelsSkipped.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {testResult.channelsSkipped.map((s, i) => (
                      <p key={i} className="text-[10px] font-mono text-zinc-500">
                        · {CHANNEL_LABEL[s.channel]}: {s.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono text-violet-300/80 uppercase tracking-wider mb-1">// step 2 · close the loop</p>
                <h2 className="text-[16px] font-semibold text-white mb-1">Dispatch critical telemetry now</h2>
                <p className="text-[12px] text-zinc-400">
                  Runs the telemetry builder, then fires Slack/Teams pings for every signal at severity ≥ high.
                  Each signal is deduped — re-firing within 10 minutes is a no-op.
                </p>
              </div>
              <button
                onClick={dispatchTelemetry}
                disabled={busy || status.configuredCount === 0}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-200 border border-violet-500/30 hover:bg-violet-500/20 disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-3.5 w-3.5" />
                {busy ? "Dispatching…" : "Dispatch high+ signals"}
              </button>
            </div>
            {telemetryOutcome && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Signals inspected" value={String(telemetryOutcome.totalSignalsInspected)} tone="zinc" />
                <Stat label="Dispatched" value={String(telemetryOutcome.totalDispatchAttempted)} tone="violet" />
                <Stat label="Succeeded" value={String(telemetryOutcome.totalDispatchSucceeded)} tone={telemetryOutcome.totalDispatchSucceeded > 0 ? "emerald" : "amber"} />
              </div>
            )}
          </div>

          {/* History panel */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-mono text-cyan-300/80 uppercase tracking-wider mb-1">// audit · OutboundNotificationRecord</p>
                <h2 className="text-[16px] font-semibold text-white">Recent sends</h2>
                <p className="text-[12px] text-zinc-400">
                  Last 50 outbound notification records — durable history, not in-memory.
                </p>
              </div>
              {history && (
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                  <div className="rounded border border-emerald-500/20 bg-emerald-500/[0.04] px-2 py-1 text-center">
                    <p className="text-emerald-300/80 uppercase">ok</p>
                    <p className="text-emerald-200 font-bold">{history.perOutcome.ok ?? 0}</p>
                  </div>
                  <div className="rounded border border-amber-500/20 bg-amber-500/[0.04] px-2 py-1 text-center">
                    <p className="text-amber-300/80 uppercase">deduped</p>
                    <p className="text-amber-200 font-bold">{history.perOutcome.deduped ?? 0}</p>
                  </div>
                  <div className="rounded border border-rose-500/20 bg-rose-500/[0.04] px-2 py-1 text-center">
                    <p className="text-rose-300/80 uppercase">failed</p>
                    <p className="text-rose-200 font-bold">{(history.perOutcome.failed ?? 0) + (history.perOutcome.skipped ?? 0)}</p>
                  </div>
                </div>
              )}
            </div>

            {!history ? (
              <p className="text-[11px] font-mono text-zinc-500">// loading…</p>
            ) : history.rows.length === 0 ? (
              <p className="text-[12px] text-zinc-400 italic">
                No outbound sends yet. Fire a test above and the row will land here.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-lg overflow-hidden">
                {history.rows.map((row) => (
                  <div key={row.id} className="px-3 py-2 hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        row.outcome === "ok"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : row.outcome === "deduped"
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                      }`}>{row.outcome}</span>
                      <span className="text-[9px] font-mono text-zinc-500 uppercase">{row.severity}</span>
                      <span className="text-[9px] font-mono text-zinc-500">{row.kind}</span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(row.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-[12px] text-white truncate mt-0.5" title={row.headline}>{row.headline}</p>
                    {(row.channelsSucceeded.length > 0 || row.channelsSkipped.length > 0) && (
                      <p className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">
                        {row.channelsSucceeded.length > 0 && <span className="text-emerald-300">✓ {row.channelsSucceeded.join(", ")}</span>}
                        {row.channelsSucceeded.length > 0 && row.channelsSkipped.length > 0 && " · "}
                        {row.channelsSkipped.length > 0 && <span>skipped {row.channelsSkipped.slice(0, 2).join(", ")}{row.channelsSkipped.length > 2 ? "…" : ""}</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">Delivery promises</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">notification_read_only</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                Every payload passes through redactPayload before transmit. Notifications announce — they never
                trigger a remediation. Operators click the safeNextAction link to act.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "violet" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber: "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    violet: "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
    zinc: "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[20px] font-bold mt-1">{value}</p>
    </div>
  );
}
