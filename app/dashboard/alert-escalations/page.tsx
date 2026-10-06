"use client";

/**
 * /dashboard/alert-escalations — Phase 432.
 *
 * Renders the Phase 431 AlertEscalation digest. Sibling to
 * /dashboard/connector-setup. Distinct from /dashboard/alerts
 * (which is the alert-rules landing page) — this page is about the
 * lifecycle of EACH alert from fire through resolution.
 *
 * Pure-presentational client page — zero derivation in React.
 */

import { useEffect, useState } from "react";
import {
  BellAlertIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  PauseCircleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

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
  amber:   "bg-amber-400",
  blue:    "bg-blue-400",
  emerald: "bg-emerald-400",
  zinc:    "bg-zinc-600",
};

const TONE_BTN: Record<ActionTone, string> = {
  primary:   "border border-white/20 bg-white text-zinc-900 hover:bg-zinc-200",
  secondary: "border border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]",
  danger:    "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15",
  none:      "border border-transparent bg-transparent text-zinc-500 cursor-default",
};

function humanAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Maps a status + ctaLabel to the operator-allowed event kind the
 * /api/dashboard/alert-event POST expects. Returns null for non-actionable
 * CTAs (resolved/auto_resolved/expired/quiet).
 */
function ctaEventKindFor(status: string): string | null {
  switch (status) {
    case "fired":
    case "escalated":     return "operator_acknowledged";
    case "acknowledged":  return "operator_resolved";
    case "snoozed":       return "operator_resolved";
    default:              return null;
  }
}

export default function AlertEscalationsPage() {
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
    <div className="relative">
      <PageIntro
        kicker={`Alerts · escalation lifecycle${data ? ` · last sync ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}`}
        title={<>Every alert. <span className="text-zinc-500">One audited lifecycle.</span></>}
        description="Per-signal alert state — fired, escalated, acknowledged, snoozed, resolved — with the full transition log. Driven by the AlertEscalationSession state machine; sticky errors from connector setup escalate here automatically."
        helps="See which alerts are waiting on a human, which are snoozed, and which cleared on their own."
        connectFirst="Already wired — alerts fire when the Phase 418 sticky-error classifier crosses the threshold on any signal."
        engineers={["Incident Engineer", "On-call rotation", "SRE"]}
        requiresApproval="Acknowledge / snooze / resolve are all human actions. Every transition is audited."
        actions={[
          { label: "Connector setup",  href: "/dashboard/connector-setup" },
          { label: "View audit log",   href: "/dashboard/audit" },
        ]}
        safetyNote="Sticky-error bridge fires alerts · never silent retry · every escalation audited"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading alert state…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300 leading-relaxed">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required to view alerts.
        </div>
      )}

      {!loading && errorBody && !["migration_pending", "auth_required"].includes(errorBody.error) && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {errorBody.error}
        </div>
      )}

      {actionError && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-3 mb-4 text-[12.5px] text-zinc-300">
          {actionError}
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Alerts" value={String(data.summary.total)} tone="zinc" icon={BellAlertIcon} />
            <Stat label="Waiting for human" value={String(data.summary.waitingForHuman)} tone={data.summary.waitingForHuman > 0 ? "rose" : "emerald"} icon={ExclamationTriangleIcon} />
            <Stat label="Open" value={String(data.summary.open)} tone={data.summary.open > 0 ? "amber" : "zinc"} icon={PauseCircleIcon} />
            <Stat label="Cleared" value={String(data.summary.terminal)} tone="emerald" icon={CheckCircleIcon} />
          </div>

          {data.alerts.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No active alerts. The sticky-error bridge will fire alerts here automatically when Phase 418 crosses the threshold.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {data.alerts.map((a) => (
                <AlertCard
                  key={a.signalRef}
                  a={a}
                  pending={pendingSignal === a.signalRef}
                  onCta={() => emit(a.signalRef, a.status)}
                  onSnooze={(minutes) => snooze(a.signalRef, minutes)}
                />
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// alert lifecycle contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                Every transition is appended to AlertEscalationTransition. The sticky-error bridge never produces audit noise.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AlertCard({
  a, pending, onCta, onSnooze,
}: {
  a: AlertDigest;
  pending: boolean;
  onCta: () => void;
  onSnooze: (minutes: number) => void;
}) {
  const eventKindForCta = ctaEventKindFor(a.status);
  const ctaClickable = a.suggested.tone !== "none" && eventKindForCta !== null;
  const canSnooze = a.open && a.status !== "snoozed";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[a.sidebarTone]}`} />
          <p className="text-[13px] font-semibold text-white tracking-tight truncate">{a.signalRef}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
            {a.statusLabel}
          </span>
          {a.minutesSinceFirstFire !== null && a.open && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-200 border border-rose-500/20">
              open {a.minutesSinceFirstFire}m
            </span>
          )}
        </div>
      </div>

      <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-2">{a.suggested.description}</p>
      {a.suggested.hint && (
        <p className="text-[11.5px] text-amber-200/90 leading-snug mb-3 italic">{a.suggested.hint}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {a.suggested.tone !== "none" && (
          <button
            type="button"
            disabled={pending || !ctaClickable}
            onClick={ctaClickable ? onCta : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition disabled:opacity-60 ${TONE_BTN[a.suggested.tone]}`}
          >
            {a.suggested.ctaLabel}
          </button>
        )}
        {canSnooze && (
          <button
            type="button"
            disabled={pending}
            onClick={() => onSnooze(15)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition disabled:opacity-60 ${TONE_BTN.secondary}`}
          >
            Snooze 15m
          </button>
        )}
      </div>

      {a.timeline.length > 0 && (
        <div className="border-t border-white/[0.04] pt-2 mt-1">
          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
            // Recent transitions
          </p>
          <ul className="space-y-1">
            {a.timeline.slice(0, 5).map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-[11.5px]">
                <ClockIcon className={`h-3 w-3 mt-0.5 shrink-0 ${l.isLegal ? "text-zinc-500" : "text-rose-400"}`} />
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

function Stat({ label, value, tone, icon: Icon }: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "zinc";
  icon?: typeof BellAlertIcon;
}) {
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
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
