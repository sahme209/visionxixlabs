import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 441b — desktop catch-up for the web's Phase 423 connector-setup
 * panel. Same digest endpoint, same render shape, native Tauri styling.
 *
 * Reads from /api/dashboard/connector-setup-digest. The endpoint already
 * supports the session-auth pattern the web dashboard uses; the desktop
 * runtime forwards the user's session cookie via the standard Tauri
 * fetch proxy, so no extra auth glue is needed at the view level.
 *
 * CTAs post to /api/dashboard/connector-setup-event with operator-allowed
 * event kinds only — server validates the closed union.
 */

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

const PROVIDER_LABEL: Record<string, string> = { aws: "AWS", azure: "Azure", gcp: "GCP" };

const DOT_CLASS: Record<SidebarDotColor, string> = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red:   "bg-rose-400",
  gray:  "bg-zinc-600",
};

const TONE_BTN: Record<ActionTone, string> = {
  primary:   "bg-violet-600 hover:bg-violet-500 text-white",
  secondary: "bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-200 border border-zinc-700/50",
  danger:    "bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/30",
  none:      "bg-transparent text-zinc-500 cursor-default",
};

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

export function ConnectorSetupView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/dashboard/connector-setup-digest", { credentials: "include" });
    setResp((await r.json()) as RespBody);
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
      if (!body.ok) setActionError(body.hint ?? body.error ?? `Request failed (${r.status})`);
      else await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPendingProvider(null);
    }
  };

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Connector setup</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Per-provider lifecycle. Every transition is audited; sticky errors escalate to alerts.
        </p>
      </div>

      {loading && (
        <div className="glass-card p-4 text-sm text-zinc-400">Loading connector setup state…</div>
      )}

      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">
          Sign in required to view connector setup state.
        </div>
      )}

      {actionError && (
        <div className="glass-card p-3 text-xs text-amber-300 border border-amber-500/20">{actionError}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Providers"    value={String(data.summary.total)} />
            <Stat label="Healthy"      value={String(data.summary.connected)} tone="emerald" />
            <Stat label="Actionable"   value={String(data.summary.actionable)}    tone={data.summary.actionable > 0 ? "rose" : "zinc"} />
            <Stat label="Sticky errs"  value={String(data.summary.stickyErrorCount)} tone={data.summary.stickyErrorCount > 0 ? "rose" : "zinc"} />
          </div>

          {data.providers.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No connector setup sessions yet. Connect a cloud from the Connectors tab to start one.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
        </>
      )}
    </ViewShell>
  );
}

function ProviderCard({ p, pending, onCta }: { p: ProviderDigest; pending: boolean; onCta: () => void }) {
  const eventKindForCta = ctaEventKindFor(p.status);
  const ctaClickable = p.suggested.tone !== "none" && eventKindForCta !== null;
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${DOT_CLASS[p.sidebarDotColor]}`} />
          <p className="text-sm font-semibold text-white">{PROVIDER_LABEL[p.provider] ?? p.provider}</p>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{p.statusLabel}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {p.daysConnected !== null && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              live {p.daysConnected}d
            </span>
          )}
          {renderErrorBadge(p.errorClass)}
        </div>
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed mb-2">{p.suggested.description}</p>
      {p.suggested.hint && (
        <p className="text-[11px] text-amber-200/90 italic mb-3">{p.suggested.hint}</p>
      )}

      {p.suggested.tone !== "none" && (
        <button
          type="button"
          disabled={pending || !ctaClickable}
          onClick={ctaClickable ? onCta : undefined}
          className={`mb-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${TONE_BTN[p.suggested.tone]}`}
        >
          {pending ? "Working…" : p.suggested.ctaLabel}
        </button>
      )}

      {p.timeline.length > 0 && (
        <div className="border-t border-zinc-800/40 pt-2 mt-1">
          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Recent transitions</p>
          <ul className="space-y-1">
            {p.timeline.slice(0, 5).map((l, i) => (
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

function renderErrorBadge(ec: ErrorClass) {
  if (ec.kind === "sticky_error") {
    return (
      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-200 border border-rose-500/25">
        sticky {ec.errorCode ?? "error"}{typeof ec.consecutiveCount === "number" ? ` ×${ec.consecutiveCount}` : ""}
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

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
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
