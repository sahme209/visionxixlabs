"use client";

/**
 * /dashboard/connector-setup — Phase 423.
 *
 * Renders the Phase 420 master digest: per-provider status pill,
 * suggested CTA, sticky-error badge, and the recent transition
 * timeline. The page does ZERO derivation — every label, every CTA,
 * every age pill comes from the responder. The dashboard is purely
 * presentational.
 *
 * Auth is session-cookie (NextAuth), so no API key required.
 * Backend route: /api/dashboard/connector-setup-digest.
 *
 * Graceful degradation: when the response is migration_pending, the
 * page renders a calm "schema pending" banner instead of an error.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type SidebarDotColor = "green" | "amber" | "red" | "gray";
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

interface ErrorClass {
  kind: "healthy" | "transient_failure" | "sticky_error" | "chronic_oscillation";
  errorCode?: string;
  consecutiveCount?: number;
  regressCount?: number;
  recoverCount?: number;
  reason?: string;
}

interface ProviderDigest {
  provider: string;
  status: string;
  statusLabel: string;
  sidebarDotColor: SidebarDotColor;
  actionable: boolean;
  daysConnected: number | null;
  minutesSinceTransition: number;
  suggested: SuggestedAction;
  errorClass: ErrorClass;
  timeline: TimelineLine[];
}

interface DigestData {
  generatedAt: string;
  providers: ProviderDigest[];
  summary: {
    total: number;
    connected: number;
    actionable: number;
    inFlight: number;
    notConnected: number;
    stickyErrorCount: number;
    chronicOscillationCount: number;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const DOT_CLASS: Record<SidebarDotColor, string> = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red:   "bg-rose-400",
  gray:  "bg-zinc-600",
};

const TONE_BTN: Record<ActionTone, string> = {
  primary:   "border border-white/20 bg-white text-zinc-900 hover:bg-zinc-200",
  secondary: "border border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]",
  danger:    "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15",
  none:      "border border-transparent bg-transparent text-zinc-500 cursor-default",
};

const PROVIDER_LABEL: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
};

/**
 * Status → the operator-allowed event kind a CTA click should emit.
 * Returns null when the CTA is informational (in-flight, needs_attention),
 * meaning the button stays purely visual.
 */
function ctaEventKindFor(status: string): string | null {
  switch (status) {
    case "not_connected":
    case "failed":
    case "disconnected":
    case "revoked":
      return "operator_started";
    case "connected":
      return "operator_disconnected";
    default:
      // setup_started / waiting_for_provider / validating / needs_attention —
      // either in-flight (server-driven) or only-cron-resolvable.
      return null;
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

export default function ConnectorSetupPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/dashboard/connector-setup-digest", { credentials: "include" });
    const json = (await r.json()) as RespBody;
    setResp(json);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/connector-setup-digest", { credentials: "include" })
      .then((r) => r.json())
      .then((json: RespBody) => { if (!cancelled) setResp(json); })
      .catch((err) => { if (!cancelled) setNetworkError(err instanceof Error ? err.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const emit = async (provider: string, status: string) => {
    const eventKind = ctaEventKindFor(status);
    if (!eventKind) return;
    setPendingProvider(provider);
    setActionError(null);
    try {
      const r = await fetch("/api/dashboard/connector-setup-event", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, eventKind }),
      });
      const body = await r.json() as { ok: boolean; error?: string; hint?: string };
      if (!body.ok) {
        setActionError(body.hint ?? body.error ?? `Request failed (${r.status})`);
      } else {
        await refresh();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPendingProvider(null);
    }
  };

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`Connectors · setup state${data ? ` · last sync ${new Date(data.generatedAt).toLocaleTimeString()}` : ""}`}
        title={<>Every connector. <span className="text-zinc-500">One canonical status.</span></>}
        description="Per-provider setup state, what the operator should do next, and the last few audit-log lines. Driven by the ConnectorSetupSession state machine — every transition is recorded, including illegal ones."
        helps="See which connectors need attention, which are healthy, and which have hit a sticky error worth escalating."
        connectFirst="At least one cloud connector. The state machine starts at `not_connected` and lights up the moment an operator clicks Connect."
        engineers={["Cloud Engineer", "Incident Engineer", "Security Engineer"]}
        requiresApproval="Disconnects and reconnects are operator-driven — every event is audited."
        actions={[
          { label: "Connect a provider", href: "/dashboard/connectors" },
          { label: "View audit log",     href: "/dashboard/audit" },
        ]}
        safetyNote="Read-only · every kernel event audited · sticky-error escalation, never silent retry"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading connector setup state…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody && errorBody.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300 leading-relaxed">
            {errorBody.hint ?? "The ConnectorSetupSession table is defined in the schema but hasn't been applied to the database yet."}
          </p>
        </div>
      )}

      {!loading && errorBody && errorBody.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required to view connector setup state.
        </div>
      )}

      {!loading && errorBody && !["migration_pending", "auth_required"].includes(errorBody.error) && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {errorBody.error}
        </div>
      )}

      {actionError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-3 mb-4 text-[12.5px] text-zinc-300">
          {actionError}
        </div>
      )}

      {data && (
        <>
          {/* Summary ribbon */}
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Connectors" value={String(data.summary.total)} tone="zinc" />
            <Stat label="Healthy" value={String(data.summary.connected)} tone="emerald" icon={CheckCircleIcon} />
            <Stat label="Actionable" value={String(data.summary.actionable)} tone={data.summary.actionable > 0 ? "rose" : "zinc"} icon={ExclamationTriangleIcon} />
            <Stat label="Sticky errors" value={String(data.summary.stickyErrorCount)} tone={data.summary.stickyErrorCount > 0 ? "rose" : "zinc"} icon={BoltIcon} />
          </div>

          {data.providers.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No connector setup sessions yet. Click <span className="text-white">Connect a provider</span> above to start one — every operator action lands a row in the audit log.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {data.providers.map((p) => (
                <ProviderCard
                  key={p.provider}
                  p={p}
                  pending={pendingProvider === p.provider}
                  onCta={() => emit(p.provider, p.status)}
                />
              ))}
            </div>
          )}

          {/* Safety footer */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// state machine contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                Every transition — legal or illegal — is appended to ConnectorSetupTransition. Sticky errors escalate; transient failures are absorbed.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProviderCard({ p, pending, onCta }: { p: ProviderDigest; pending: boolean; onCta: () => void }) {
  const errorBadge = renderErrorBadge(p.errorClass);
  const eventKindForCta = ctaEventKindFor(p.status);
  const ctaClickable = p.suggested.tone !== "none" && eventKindForCta !== null;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${DOT_CLASS[p.sidebarDotColor]}`} />
          <p className="text-[14px] font-semibold text-white tracking-tight">
            {PROVIDER_LABEL[p.provider] ?? p.provider}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{p.statusLabel}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {p.daysConnected !== null && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              live {p.daysConnected}d
            </span>
          )}
          {errorBadge}
        </div>
      </div>

      <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-2">{p.suggested.description}</p>
      {p.suggested.hint && (
        <p className="text-[11.5px] text-amber-200/90 leading-snug mb-3 italic">{p.suggested.hint}</p>
      )}

      {p.suggested.tone !== "none" && (
        <button
          type="button"
          disabled={pending || !ctaClickable}
          onClick={ctaClickable ? onCta : undefined}
          className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition disabled:opacity-60 ${TONE_BTN[p.suggested.tone]}`}
        >
          {pending && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
          {p.suggested.ctaLabel}
        </button>
      )}

      {p.timeline.length > 0 && (
        <div className="border-t border-white/[0.04] pt-2 mt-1">
          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
            // Recent transitions
          </p>
          <ul className="space-y-1">
            {p.timeline.slice(0, 5).map((l, i) => (
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

function renderErrorBadge(ec: ErrorClass) {
  if (ec.kind === "sticky_error") {
    return (
      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-200 border border-rose-500/25">
        sticky {ec.errorCode ?? "error"}
        {typeof ec.consecutiveCount === "number" ? ` ×${ec.consecutiveCount}` : ""}
      </span>
    );
  }
  if (ec.kind === "chronic_oscillation") {
    return (
      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/25">
        oscillating
      </span>
    );
  }
  if (ec.kind === "transient_failure") {
    return (
      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
        recent failure
      </span>
    );
  }
  return null;
}

function Stat({ label, value, tone, icon: Icon }: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "zinc";
  icon?: typeof ArrowPathIcon;
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
