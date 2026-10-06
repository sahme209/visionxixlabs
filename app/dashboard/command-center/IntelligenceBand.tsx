/**
 * Command Center Intelligence Band — Phase 651.
 *
 * Server-rendered top band that answers, on first paint, the founder's
 * audit question: "What can Axiom actually do right now?"
 *
 * Pure projection — reads:
 *   · lib/actions/actionRegistry.ts (typed metadata; no network)
 *   · ControlPlaneState passed in from the parent server page
 *
 * No mock data. No invented capabilities. Every label sourced from
 * typed metadata or persisted state. Buttons that can't fire safely
 * are rendered with their honest blockedReason.
 */

import Link from "next/link";
import {
  BoltIcon,
  CheckCircleIcon,
  EyeIcon,
  CogIcon,
  NoSymbolIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  SparklesIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import type { ControlPlaneState, NextBestAction } from "@/lib/controlPlane/controlPlaneModel";
import { computeHonestyCounts, ACTION_REGISTRY } from "@/lib/actions/actionRegistry";

const RISK_TONE: Record<NextBestAction["riskLevel"], string> = {
  low:      "text-emerald-300",
  medium:   "text-zinc-300",
  high:     "text-rose-300",
  critical: "text-rose-300",
};

function actionHref(a: NextBestAction): string | undefined {
  if (a.route) return a.route;
  return undefined;
}

function ActionCard({ action }: { action: NextBestAction }) {
  const href = actionHref(action);
  const tone = RISK_TONE[action.riskLevel] ?? "text-zinc-300";
  const blocked = !action.canRunNow;

  const inner = (
    <div className={`rounded-md border ${blocked ? "border-rose-500/20 bg-rose-500/[0.03]" : "border-white/[0.08] bg-white/[0.015] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"} p-4 transition-colors h-full`}>
      <div className="flex items-center justify-between gap-2 mb-2 text-[10px] font-mono uppercase tracking-wider">
        <span className={tone}>{action.riskLevel}</span>
        <span className="text-zinc-500">{action.category.replace(/_/g, " ")}</span>
      </div>
      <p className="text-[13.5px] font-medium text-white leading-snug mb-1.5">{action.title}</p>
      <p className="text-[12px] text-zinc-400 leading-relaxed mb-3 line-clamp-3">{action.description}</p>
      <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono">
        <span className="text-zinc-500">
          {action.provider && <span className="text-zinc-400">{String(action.provider)}</span>}
          {action.connector && <span className="text-zinc-400">{action.connector}</span>}
          {action.approvalRequired && <span className="text-emerald-300 ml-1">· approval</span>}
          {action.desktopEligible && <span className="text-sky-300 ml-1">· desktop</span>}
        </span>
        {blocked ? (
          <span className="text-rose-300">blocked</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-300">open <ArrowRightIcon className="h-3 w-3" /></span>
        )}
      </div>
      {action.blockedReason && (
        <p className="text-[10.5px] text-rose-200/80 leading-relaxed mt-2 font-mono">{action.blockedReason}</p>
      )}
    </div>
  );

  if (href && !blocked) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return <div className="h-full">{inner}</div>;
}

export function IntelligenceBand({
  state,
  dispatch24h = 0,
  lastDispatchAt = null,
}: {
  state: ControlPlaneState | null;
  /** Phase 663: count of workforce_action_execution rows updated in the last 24h. */
  dispatch24h?: number;
  /** Most recent dispatch timestamp — used to show "last activity" line. */
  lastDispatchAt?: Date | null;
}) {
  const counts = computeHonestyCounts();
  const top3: NextBestAction[] = state?.nextBestActions?.slice(0, 3) ?? [];
  const autonomousTasks = state?.autonomousTasks ?? { pending: 0, completed: 0, blocked: 0 };
  const blockerCount = state?.blockers?.length ?? 0;
  const top3Blockers = state?.blockers?.slice(0, 3) ?? [];
  const validationStatus = state?.validationPosture?.status ?? "unknown";
  const validationScore = state?.validationPosture?.score ?? 0;
  const providersConnected = state?.providers?.filter((p) => p.mode === "live").length ?? 0;
  const providersTotal = state?.providers?.length ?? 3;

  return (
    <div className="mb-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.025] p-5 sm:p-6">
      {/* Headline */}
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-2 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>operating-state</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400">what axiom can do right now</span>
        </p>
        <p className="text-[14.5px] sm:text-[15px] text-zinc-100 leading-relaxed max-w-3xl">
          Axiom catalogs <span className="text-white font-semibold">{counts.total}</span> typed operator actions —{" "}
          <span className="text-emerald-300 font-semibold">{counts.live} live</span>,{" "}
          <span className="text-sky-300 font-semibold">{counts.preview} preview</span>,{" "}
          <span className="text-emerald-300 font-semibold">{counts.governed} governed</span>,{" "}
          <span className="text-zinc-300 font-semibold">{counts.needs_setup} need setup</span>,{" "}
          <span className="text-rose-300 font-semibold">{counts.unsafe} unsafe blocked by design</span>.
          {" "}<Link href="/dashboard/capabilities" className="text-emerald-300 hover:text-white transition-colors underline underline-offset-2">audit every action →</Link>
        </p>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatChip
          icon={CheckCircleIcon}
          label="Live"
          value={String(counts.live)}
          tone="emerald"
        />
        <StatChip
          icon={EyeIcon}
          label="Preview"
          value={String(counts.preview)}
          tone="sky"
        />
        <StatChip
          icon={ShieldCheckIcon}
          label="Governed"
          value={String(counts.governed)}
          tone="emerald"
          sub="approval-gated"
        />
        <StatChip
          icon={CogIcon}
          label="Needs setup"
          value={String(counts.needs_setup)}
          tone="amber"
        />
        <StatChip
          icon={NoSymbolIcon}
          label="Unsafe blocked"
          value={String(counts.unsafe)}
          tone="rose"
          sub="by design"
        />
      </div>

      {/* Top 3 next-best actions */}
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">top-actions</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400">ranked by control-plane next-best-action engine</span>
        </p>
        {top3.length === 0 ? (
          <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-6 text-center">
            <BoltIcon className="h-5 w-5 text-emerald-300 mx-auto mb-2" />
            <p className="text-[13px] text-zinc-300">
              No ranked actions right now.
            </p>
            <p className="text-[11.5px] text-zinc-500 mt-1 font-mono">
              connect a provider or run a scan to surface next-best-actions
            </p>
            <Link
              href="/dashboard/connectors"
              className="inline-block mt-3 text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors"
            >
              connect provider →
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {top3.map((a) => <ActionCard key={a.id} action={a} />)}
          </div>
        )}
      </div>

      {/* Phase 662: top-3 blockers — only when something is actually blocking the safe loop */}
      {top3Blockers.length > 0 && (
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span className="text-zinc-300">top-blockers</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-400 tabular-nums">{blockerCount}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">what is stopping axiom from doing more</span>
          </p>
          <ul className="rounded-md border border-white/20 bg-white/[0.03] divide-y divide-white/[0.04] overflow-hidden">
            {top3Blockers.map((b, i) => {
              const inner = (
                <div className="flex items-start gap-3 px-4 py-3">
                  <ExclamationTriangleIcon className="h-4 w-4 text-zinc-300 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-0.5">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-300">{b.code}</p>
                      {b.route && (
                        <span className="text-[10px] font-mono text-emerald-300 inline-flex items-center gap-1">resolve <ArrowRightIcon className="h-3 w-3" /></span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-zinc-100 leading-relaxed">{b.detail}</p>
                  </div>
                </div>
              );
              return (
                <li key={`${b.code}_${i}`}>
                  {b.route ? (
                    <Link href={b.route} className="block hover:bg-white/[0.02] transition-colors">
                      {inner}
                    </Link>
                  ) : (
                    <div>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Operating-loop status strip */}
      <div className="grid sm:grid-cols-5 gap-3 pt-5 border-t border-white/[0.06]">
        <StripCell
          icon={CommandLineIcon}
          label="Providers"
          value={`${providersConnected}/${providersTotal} live`}
          href="/dashboard/connectors"
        />
        <StripCell
          icon={ShieldCheckIcon}
          label="Validation"
          value={`${validationStatus} · ${validationScore}/100`}
          href="/dashboard/validation"
          tone={validationStatus === "healthy" ? "emerald" : validationStatus === "warning" ? "amber" : "zinc"}
        />
        <StripCell
          icon={ClockIcon}
          label="Safe loop"
          value={`${autonomousTasks.completed} done · ${autonomousTasks.pending} pending · ${autonomousTasks.blocked} blocked`}
          tone={autonomousTasks.blocked > 0 ? "rose" : "zinc"}
        />
        <StripCell
          icon={BoltIcon}
          label="24h dispatches"
          value={dispatch24h === 0
            ? "none yet"
            : `${dispatch24h} · last ${lastDispatchAt ? formatRelative(lastDispatchAt) : "n/a"}`}
          href="/dashboard/capabilities"
          tone={dispatch24h > 0 ? "emerald" : "zinc"}
        />
        <StripCell
          icon={ExclamationTriangleIcon}
          label="Blockers"
          value={blockerCount === 0 ? "none" : `${blockerCount} active`}
          tone={blockerCount === 0 ? "emerald" : "amber"}
        />
      </div>

      {/* Phase 666: operator quality-of-life footer — safe self-navigating
          refresh + Copilot + machine-readable health JSON */}
      <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-4 flex-wrap text-[11px] font-mono">
        <Link
          href="/dashboard/command-center"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
          title="Re-fetches control-plane state — page is force-dynamic so navigating rebuilds"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" />
          refresh state
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href="/dashboard/copilot"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          ask copilot
        </Link>
        <span className="text-zinc-700">·</span>
        <a
          href="/api/capabilities/health"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
          title="Machine-readable platform health JSON for external monitoring"
        >
          <CodeBracketIcon className="h-3.5 w-3.5" />
          health json
        </a>
        {state?.generatedAt && (
          <span className="ml-auto text-zinc-600">
            state @ {state.generatedAt.slice(11, 19)} UTC
          </span>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Small atoms
// ───────────────────────────────────────────────────────────────────

const TONE_BORDER: Record<string, string> = {
  emerald: "border-emerald-500/25 bg-emerald-500/[0.05]",
  sky:     "border-sky-500/25 bg-sky-500/[0.05]",
  amber:   "border-white/25 bg-white/[0.05]",
  rose:    "border-rose-500/25 bg-rose-500/[0.05]",
  zinc:    "border-white/[0.06] bg-white/[0.012]",
};
const TONE_TEXT: Record<string, string> = {
  emerald: "text-emerald-300",
  sky:     "text-sky-300",
  amber:   "text-zinc-300",
  rose:    "text-rose-300",
  zinc:    "text-zinc-300",
};

function StatChip({
  icon: Icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: typeof CheckCircleIcon;
  label: string;
  value: string;
  tone: "emerald" | "sky" | "amber" | "rose" | "zinc";
  sub?: string;
}) {
  return (
    <div className={`rounded-md border ${TONE_BORDER[tone]} px-4 py-3`}>
      <Icon className={`h-4 w-4 mb-1.5 ${TONE_TEXT[tone]}`} />
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-[20px] font-semibold tabular-nums ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

function StripCell({
  icon: Icon,
  label,
  value,
  href,
  tone = "zinc",
}: {
  icon: typeof CheckCircleIcon;
  label: string;
  value: string;
  href?: string;
  tone?: "emerald" | "sky" | "amber" | "rose" | "zinc";
}) {
  const inner = (
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 ${TONE_TEXT[tone]} shrink-0`} />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="text-[12.5px] text-zinc-100 truncate">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:bg-white/[0.02] rounded-md -mx-1 px-1 py-1 transition-colors">
        {inner}
      </Link>
    );
  }
  return <div className="px-1 py-1">{inner}</div>;
}

/**
 * Honest no-state version — rendered when buildControlPlaneState
 * throws or returns nothing. Still shows the registry counts so
 * the founder's question is answered even if the workspace data
 * isn't ready.
 */
export function IntelligenceBandFallback({ reason }: { reason?: string }) {
  const counts = computeHonestyCounts();
  return (
    <div className="mb-8 rounded-md border border-white/[0.08] bg-white/[0.012] p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
        <span className="text-zinc-700">//</span>
        <span>operating-state</span>
        <span className="text-zinc-700">::</span>
        <span className="text-zinc-300">partial — control plane unavailable</span>
      </p>
      <p className="text-[14px] text-zinc-300 leading-relaxed max-w-3xl mb-4">
        Axiom catalogs <span className="text-white font-semibold">{ACTION_REGISTRY.length}</span> typed operator actions
        — <span className="text-emerald-300">{counts.live} live</span>,{" "}
        <span className="text-sky-300">{counts.preview} preview</span>,{" "}
        <span className="text-rose-300">{counts.unsafe} unsafe blocked</span>.
        Control plane state could not be fetched this render — registry counts still reflect product reality.
      </p>
      {reason && <p className="text-[11px] text-rose-200/70 font-mono mb-3">{reason}</p>}
      <Link
        href="/dashboard/capabilities"
        className="inline-block text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors"
      >
        audit every action →
      </Link>
    </div>
  );
}

/** Compact relative-time formatter for the "24h dispatches · last X ago"
 *  strip cell. Server-rendered, so no client tick — we accept the
 *  snapshot-at-render-time tradeoff. */
function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}
