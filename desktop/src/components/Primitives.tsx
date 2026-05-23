/**
 * Shared UI primitives — Huly-style cards, badges, KPIs, section headers.
 *
 * Every view in the desktop app composes from these so the look stays
 * coherent. No view should hand-roll a card; if a new variant is needed,
 * add it here.
 */

import { type ReactNode, type ComponentType, type ButtonHTMLAttributes, type HTMLAttributes, type MouseEvent } from "react";
import { openExternal } from "../lib/notifications";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  glow = false,
  tint,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { glow?: boolean; tint?: "violet" | "cyan" | "amber" | "emerald" | "rose" }) {
  const tintBg = tint === "violet"  ? "before:bg-violet-500/10"
              : tint === "cyan"     ? "before:bg-cyan-500/10"
              : tint === "amber"    ? "before:bg-amber-500/10"
              : tint === "emerald"  ? "before:bg-emerald-500/10"
              : tint === "rose"     ? "before:bg-rose-500/10"
              : "";
  return (
    <div
      {...rest}
      className={`glass-card-lift edge-light relative ${glow ? "shadow-glow-violet" : ""} ${tint ? `before:content-[''] before:absolute before:-top-12 before:-right-12 before:w-32 before:h-32 before:rounded-full before:blur-[40px] before:pointer-events-none ${tintBg}` : ""} ${className}`}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

export function SectionHeader({
  kicker,
  title,
  subtitle,
  Icon,
  action,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  Icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
      <div>
        {kicker && (
          <div className="flex items-center gap-2 mb-2">
            {Icon && <Icon className="h-3.5 w-3.5 text-violet-300" />}
            <span className="section-kicker text-violet-300">{kicker}</span>
          </div>
        )}
        <h1 className="section-title">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export type BadgeTone = "success" | "warning" | "danger" | "preview" | "neutral" | "cyan";

export function Badge({ tone = "neutral", children, dotted = false }: { tone?: BadgeTone; children: ReactNode; dotted?: boolean }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dotted && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

export function Kpi({
  label,
  value,
  delta,
  deltaTone,
  Icon,
  tone = "violet",
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  Icon?: ComponentType<{ className?: string }>;
  tone?: "violet" | "cyan" | "emerald" | "amber" | "rose";
}) {
  const valueTone =
    tone === "violet"  ? "text-violet-200" :
    tone === "cyan"    ? "text-cyan-200" :
    tone === "emerald" ? "text-emerald-200" :
    tone === "amber"   ? "text-amber-200" :
    "text-rose-200";

  const deltaCls =
    deltaTone === "up"   ? "text-emerald-300" :
    deltaTone === "down" ? "text-rose-300" :
    "text-zinc-500";

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <span className="metric-label">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-zinc-600" />}
      </div>
      <span className={`metric-value tabular-mono ${valueTone}`}>{value}</span>
      {delta && <span className={`metric-delta ${deltaCls}`}>{delta}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Posture tile
// ---------------------------------------------------------------------------

export function PostureTile({
  label,
  score,
  status,
  detail,
}: {
  label: string;
  score: number;
  status: "healthy" | "warning" | "degraded" | "preview" | "blocked" | "unknown";
  detail?: string;
}) {
  const tone: BadgeTone =
    status === "healthy"  ? "success" :
    status === "warning"  ? "warning" :
    status === "degraded" ? "danger" :
    status === "preview"  ? "preview" :
    status === "blocked"  ? "danger" :
    "neutral";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="metric-label">{label}</span>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold tabular-mono text-white">{score}</span>
        <span className="text-xs text-zinc-500">/100</span>
      </div>
      {detail && <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{detail}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  Icon,
  title,
  detail,
  action,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 mx-auto mb-4 flex items-center justify-center">
        <Icon className="h-5 w-5 text-violet-300" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      {detail && <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5 leading-relaxed">{detail}</p>}
      {action}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DataSourceBanner — closed-union of the three states every desktop view
// can be in. Replaces the silent mock-data fallback with an honest signal:
//
//   "preview"          — no API key paired; view is showing mock data
//   "authenticated_no_data" — key paired, but the upstream endpoint
//                             returned nothing (legacy /api/* not
//                             implemented yet on the platform)
//   "live"             — key paired AND the call returned real data
//
// Drop this at the top of any view that historically falls back to mock
// so the user always knows what they're looking at.
// ---------------------------------------------------------------------------

export type DataSourceMode = "preview" | "authenticated_no_data" | "live";

function openInWebClick(webPath: string): (e: MouseEvent) => void {
  // Anchor clicks inside a Tauri webview can sometimes navigate the app
  // itself (depending on platform + webview policy). Always route through
  // tauri-plugin-shell so the link reliably opens in the OS browser, then
  // suppress the default to avoid the in-app navigation race.
  return (e) => {
    e.preventDefault();
    void openExternal(`https://visionxixlabs.com${webPath}`);
  };
}

export function DataSourceBanner({
  mode,
  webPath,
  surfaceName,
}: {
  mode: DataSourceMode;
  webPath: string;
  surfaceName: string;
}) {
  if (mode === "live") {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-[11px] font-mono flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-emerald-300 uppercase tracking-[0.18em]">live</span>
        <span className="text-zinc-500">· {surfaceName} populated from your authenticated workspace.</span>
      </div>
    );
  }
  if (mode === "authenticated_no_data") {
    return (
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] font-mono">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-amber-300 uppercase tracking-[0.18em]">no live data yet</span>
        </div>
        <p className="text-zinc-400 leading-relaxed font-sans text-[12px]">
          API key paired, but the {surfaceName} surface isn&apos;t implemented for this workspace yet.
          Showing realistic mock data so the UI stays useful while the backend catches up.
          <a
            href={`https://visionxixlabs.com${webPath}`}
            onClick={openInWebClick(webPath)}
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 hover:text-violet-200 ml-1 underline-offset-2 hover:underline"
          >Open the web view →</a>
        </p>
      </div>
    );
  }
  // "preview"
  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2.5 text-[11px] font-mono">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        <span className="text-violet-300 uppercase tracking-[0.18em]">preview · mock data</span>
      </div>
      <p className="text-zinc-400 leading-relaxed font-sans text-[12px]">
        No API key configured. Paste a <span className="font-mono text-zinc-300">vxlk_live_…</span> key in
        <span className="font-mono text-zinc-300"> Settings → VisionXIXLabs API key</span> to load real {surfaceName} from your workspace.
        <a
          href={`https://visionxixlabs.com${webPath}`}
          onClick={openInWebClick(webPath)}
          target="_blank"
          rel="noreferrer"
          className="text-violet-300 hover:text-violet-200 ml-1 underline-offset-2 hover:underline"
        >Open in web →</a>
      </p>
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin mx-auto mb-3" />
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export function PrimaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`btn-primary ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`btn-secondary ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// View shell
// ---------------------------------------------------------------------------

export function ViewShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto bg-axiom-bg">
      <div className="aurora-bg">
        <div className="relative z-10 max-w-6xl mx-auto px-8 py-10 space-y-8 animate-fade-in-up">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk + status tone helpers (exported for view-specific compositions)
// ---------------------------------------------------------------------------

export function riskToneFor(risk: "low" | "medium" | "high" | "critical" | "info" | string): BadgeTone {
  switch (risk) {
    case "critical": return "danger";
    case "high":     return "warning";
    case "medium":   return "cyan";
    case "low":
    case "info":     return "neutral";
    default:         return "neutral";
  }
}

export function statusToneFor(status: string): BadgeTone {
  switch (status) {
    case "pass":
    case "passing":
    case "completed":
    case "ready":
    case "approved":
    case "simulated":     return "success";
    case "warn":
    case "warning":
    case "partial":
    case "pending":
    case "requires_approval": return "warning";
    case "fail":
    case "failing":
    case "blocked":
    case "rejected":
    case "blocked_by_policy":
    case "execution_disabled":
    case "unsafe":        return "danger";
    case "preview":
    case "preview_only":
    case "needs_validation":  return "preview";
    default:                  return "neutral";
  }
}
