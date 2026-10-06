import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 441b — desktop catch-up for the web's Phase 432 alert escalations
 * panel. Sibling to ConnectorSetupView. Reads from /api/dashboard/alert-digest
 * and posts to /api/dashboard/alert-event with operator-allowed kinds only
 * (operator_acknowledged | operator_snoozed | operator_resolved).
 */

type SidebarTone = "red" | "amber" | "blue" | "emerald" | "zinc";
type ActionTone = "primary" | "secondary" | "danger" | "none";

interface SuggestedAction {
  ctaLabel: string;
  tone: ActionTone;
  description: string;
  hint?: string;
}

interface TimelineLine {
  ageSeconds: number;
  text: string;
  isLegal: boolean;
}

interface AlertDigest {
  signalRef: string;
  status: string;
  statusLabel: string;
  sidebarTone: SidebarTone;
  waitingForHuman: boolean;
  open: boolean;
  terminal: boolean;
  minutesSinceFirstFire: number | null;
  minutesUntilSnoozeExpires: number | null;
  acknowledgedByUserId: string | null;
  resolvedByUserId: string | null;
  suggested: SuggestedAction;
  timeline: TimelineLine[];
}

interface DigestData {
  generatedAt: string;
  alerts: AlertDigest[];
  summary: { total: number; waitingForHuman: number; open: number; terminal: number; quiet: number };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const DOT_CLASS: Record<SidebarTone, string> = {
  red:     "bg-rose-400",
  amber:   "bg-zinc-400",
  blue:    "bg-blue-400",
  emerald: "bg-emerald-400",
  zinc:    "bg-zinc-600",
};

const TONE_BTN: Record<ActionTone, string> = {
  primary:   "bg-violet-600 hover:bg-violet-500 text-white",
  secondary: "bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-200 border border-zinc-700/50",
  danger:    "bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/30",
  none:      "bg-transparent text-zinc-500 cursor-default",
};

function ctaEventKindFor(status: string): string | null {
  switch (status) {
    case "fired":
    case "escalated":     return "operator_acknowledged";
    case "acknowledged":
    case "snoozed":       return "operator_resolved";
    default:              return null;
  }
}

function humanAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AlertEscalationsView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [pendingSignal, setPendingSignal] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/dashboard/alert-digest", { credentials: "include" });
    setResp((await r.json()) as RespBody);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/alert-digest", { credentials: "include" })
      .then((r) => r.json())
      .then((json: RespBody) => { if (!cancelled) setResp(json); })
      .catch((err) => { if (!cancelled) setNetworkError(err instanceof Error ? err.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const emit = async (signalRef: string, status: string) => {
    const eventKind = ctaEventKindFor(status);
    if (!eventKind) return;
    setPendingSignal(signalRef);
    setActionError(null);
    try {
      const r = await fetch("/api/dashboard/alert-event", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signalRef, eventKind }),
      });
      const body = await r.json() as { ok: boolean; error?: string; hint?: string };
      if (!body.ok) setActionError(body.hint ?? body.error ?? `Request failed (${r.status})`);
      else await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPendingSignal(null);
    }
  };

  const snooze = async (signalRef: string, snoozeMinutes: number) => {
    setPendingSignal(signalRef);
    setActionError(null);
    try {
      const r = await fetch("/api/dashboard/alert-event", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signalRef, eventKind: "operator_snoozed", snoozeMinutes }),
      });
      const body = await r.json() as { ok: boolean; error?: string; hint?: string };
      if (!body.ok) setActionError(body.hint ?? body.error ?? `Request failed (${r.status})`);
      else await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPendingSignal(null);
    }
  };

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Alert escalations</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Per-signal lifecycle. Sticky errors from connector setup auto-fire here every 10 minutes.
        </p>
      </div>

      {loading && (
        <div className="glass-card p-4 text-sm text-zinc-400">Loading alert state…</div>
      )}

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
        <div className="glass-card p-4 text-sm text-zinc-300 border border-white/20">
          Sign in required to view alerts.
        </div>
      )}

      {actionError && (
        <div className="glass-card p-3 text-xs text-zinc-300 border border-white/20">{actionError}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Alerts"            value={String(data.summary.total)} />
            <Stat label="Waiting human"     value={String(data.summary.waitingForHuman)} tone={data.summary.waitingForHuman > 0 ? "rose" : "emerald"} />
            <Stat label="Open"              value={String(data.summary.open)}            tone={data.summary.open > 0 ? "amber" : "zinc"} />
            <Stat label="Cleared"           value={String(data.summary.terminal)}        tone="emerald" />
          </div>

          {data.alerts.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No active alerts. The sticky-error bridge will fire alerts here automatically.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.alerts.map((a) => (
                <AlertCard
                  key={a.signalRef}
                  a={a}
                  pending={pendingSignal === a.signalRef}
                  onCta={() => emit(a.signalRef, a.status)}
                  onSnooze={() => snooze(a.signalRef, 15)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

function AlertCard({
  a, pending, onCta, onSnooze,
}: { a: AlertDigest; pending: boolean; onCta: () => void; onSnooze: () => void }) {
  const eventKindForCta = ctaEventKindFor(a.status);
  const ctaClickable = a.suggested.tone !== "none" && eventKindForCta !== null;
  const canSnooze = a.open && a.status !== "snoozed";
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[a.sidebarTone]}`} />
          <p className="text-sm font-semibold text-white truncate">{a.signalRef}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
            {a.statusLabel}
          </span>
          {a.minutesSinceFirstFire !== null && a.open && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-200 border border-rose-500/20">
              open {a.minutesSinceFirstFire}m
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed mb-2">{a.suggested.description}</p>
      {a.suggested.hint && (
        <p className="text-[11px] text-zinc-200/90 italic mb-3">{a.suggested.hint}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {a.suggested.tone !== "none" && (
          <button
            type="button"
            disabled={pending || !ctaClickable}
            onClick={ctaClickable ? onCta : undefined}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${TONE_BTN[a.suggested.tone]}`}
          >
            {a.suggested.ctaLabel}
          </button>
        )}
        {canSnooze && (
          <button
            type="button"
            disabled={pending}
            onClick={onSnooze}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${TONE_BTN.secondary}`}
          >
            Snooze 15m
          </button>
        )}
      </div>

      {a.timeline.length > 0 && (
        <div className="border-t border-zinc-800/40 pt-2 mt-1">
          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Recent transitions</p>
          <ul className="space-y-1">
            {a.timeline.slice(0, 5).map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px]">
                <span className={l.isLegal ? "text-zinc-300" : "text-rose-300/90 italic"}>
                  {l.text} <span className="text-zinc-600">· {humanAge(l.ageSeconds)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "rose" | "amber" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    rose:    "border-rose-500/20 text-rose-200",
    amber:   "border-white/20 text-zinc-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
