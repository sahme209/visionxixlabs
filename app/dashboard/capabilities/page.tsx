/**
 * /dashboard/capabilities — Phase 650.
 *
 * The single honest answer to "what can Axiom do right now?".
 *
 * Reads from:
 *   · lib/actions/actionRegistry.ts — typed catalog of every concrete
 *     operator action across the platform.
 *   · lib/validation/platformValidationMatrix.ts — orthogonal evidence
 *     that each row's evidence reference still resolves.
 *
 * Operators land here when they want to know exactly what's wired vs
 * what's preview vs what's blocked. No marketing copy. Every status
 * label is sourced from typed metadata, not hand-written.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CommandLineIcon,
  CheckCircleIcon,
  EyeIcon,
  CogIcon,
  NoSymbolIcon,
  ClockIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import {
  ACTION_REGISTRY,
  CATEGORY_LABEL,
  STATUS_LABEL,
  SAFETY_LABEL,
  computeHonestyCounts,
  getActionsByCategory,
  surfaceForAction,
  type ActionDescriptor,
  type WireStatus,
  type SafetyTier,
} from "@/lib/actions/actionRegistry";
import { VALIDATION_MATRIX, type ValidationRow } from "@/lib/validation/platformValidationMatrix";

/** Pull the area prefix (before first dot) from an action kind so we
 *  can join action rows against validation-matrix rows. */
function actionArea(kind: string): string {
  const dot = kind.indexOf(".");
  return dot === -1 ? kind : kind.slice(0, dot);
}

/** Map an action kind prefix to a validation matrix area. The matrix
 *  uses coarse area buckets — keep the mapping honest, no fuzzy
 *  guesses. */
const KIND_PREFIX_TO_MATRIX_AREA: Record<string, ValidationRow["area"]> = {
  aws: "aws",
  azure: "azure",
  gcp: "gcp",
  github: "github",
  releaseops: "release",
  security: "security_scanner",
  remediation: "security_scanner",
  simulation: "security_scanner",
  approval: "command_center",
  preflight: "command_center",
  execution: "security_scanner",
  autonomy: "operating_loop",
  copilot: "command_center",
  audit: "compliance",
  integration: "command_center",
  engineer: "command_center",
};

/** Find the validation matrix rows that share an area with the
 *  action's kind. Returns counts so the operator sees how many rows
 *  in the matrix back this action's category. */
function matrixSummaryForAction(a: ActionDescriptor): { total: number; passing: number; blocked: number } {
  const area = KIND_PREFIX_TO_MATRIX_AREA[actionArea(a.kind)];
  if (!area) return { total: 0, passing: 0, blocked: 0 };
  const rows = VALIDATION_MATRIX.filter((r) => r.area === area);
  return {
    total: rows.length,
    passing: rows.filter((r) => r.status === "passing").length,
    blocked: rows.filter((r) => r.status === "blocked" || r.status === "failing").length,
  };
}

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<WireStatus, { text: string; bg: string; border: string }> = {
  live:        { text: "text-emerald-300", bg: "bg-emerald-500/[0.08]", border: "border-emerald-500/30" },
  preview:     { text: "text-sky-300",     bg: "bg-sky-500/[0.08]",     border: "border-sky-500/30" },
  needs_setup: { text: "text-amber-300",   bg: "bg-amber-500/[0.08]",   border: "border-amber-500/30" },
  blocked:     { text: "text-rose-300",    bg: "bg-rose-500/[0.08]",    border: "border-rose-500/30" },
  planned:     { text: "text-zinc-400",    bg: "bg-white/[0.03]",       border: "border-white/[0.08]" },
};

const STATUS_ICON: Record<WireStatus, typeof CheckCircleIcon> = {
  live:        CheckCircleIcon,
  preview:     EyeIcon,
  needs_setup: CogIcon,
  blocked:     NoSymbolIcon,
  planned:     ClockIcon,
};

const SAFETY_TONE: Record<SafetyTier, string> = {
  read_only: "text-zinc-400",
  preview:   "text-sky-400",
  governed:  "text-emerald-400",
  unsafe:    "text-rose-400",
};

export default async function CapabilitiesPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/signin?callbackUrl=/dashboard/capabilities");
  }

  const counts = computeHonestyCounts();
  const byCategory = getActionsByCategory();
  const matrixPassing = VALIDATION_MATRIX.filter((r) => r.status === "passing").length;
  const matrixTotal = VALIDATION_MATRIX.length;

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">capabilities</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">what works right now</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <CommandLineIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Action surface
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-2xl">
          One honest catalog of every concrete action Axiom can take in your workspace today.
          Each row is sourced from <code className="text-zinc-300 font-mono text-[12.5px]">lib/actions/actionRegistry.ts</code> and
          cross-checked against the platform validation matrix.
          No marketing claims, no aspirational language — if it says <span className="text-emerald-300 font-mono">live</span>,
          the route resolves to a real service. If it says <span className="text-rose-300 font-mono">blocked</span>,
          the blocker is documented inline.
        </p>
      </header>

      {/* Honesty counts — the founder-level answer */}
      <section className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>action-counts</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400 tabular-nums">{counts.total}</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([
            { k: "live" as WireStatus,        n: counts.live },
            { k: "preview" as WireStatus,     n: counts.preview },
            { k: "needs_setup" as WireStatus, n: counts.needs_setup },
            { k: "blocked" as WireStatus,     n: counts.blocked },
            { k: "planned" as WireStatus,     n: counts.planned },
          ]).map(({ k, n }) => {
            const tone = STATUS_TONE[k];
            const Icon = STATUS_ICON[k];
            return (
              <div key={k} className={`rounded-md border ${tone.border} ${tone.bg} px-4 py-3`}>
                <Icon className={`h-4 w-4 mb-1.5 ${tone.text}`} />
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">{STATUS_LABEL[k]}</p>
                <p className={`text-[22px] font-semibold tabular-nums ${tone.text}`}>{n}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11.5px] text-zinc-500 font-mono mt-3">
          orthogonal evidence ::{" "}
          <Link href="/dashboard/validation" className="text-emerald-300 hover:text-white transition-colors underline underline-offset-2">
            validation matrix · {matrixPassing}/{matrixTotal} passing →
          </Link>
        </p>
      </section>

      {/* Safety tier breakdown */}
      <section className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>safety-tier</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">what can change cloud state</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Read-only</p>
            <p className="text-[18px] font-semibold tabular-nums text-zinc-300">{ACTION_REGISTRY.filter((a) => a.safetyTier === "read_only").length}</p>
          </div>
          <div className="rounded-md border border-sky-500/20 bg-sky-500/[0.04] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-sky-300 mb-1">Preview</p>
            <p className="text-[18px] font-semibold tabular-nums text-sky-300">{ACTION_REGISTRY.filter((a) => a.safetyTier === "preview").length}</p>
          </div>
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-300 mb-1">Governed</p>
            <p className="text-[18px] font-semibold tabular-nums text-emerald-300">{counts.governed}</p>
          </div>
          <div className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-rose-300 mb-1">Unsafe (blocked)</p>
            <p className="text-[18px] font-semibold tabular-nums text-rose-300">{counts.unsafe}</p>
          </div>
        </div>
        <p className="text-[11.5px] text-zinc-500 mt-3 leading-relaxed max-w-2xl">
          {counts.unsafe} actions can mutate cloud state. Every one is currently <span className="text-rose-300 font-mono">blocked</span> at the
          TypeScript level until approval signatures, sandbox credential testing, and rollback attachment ship together.
          This is intentional — Axiom never executes unsafely.
        </p>
      </section>

      {/* Actions by category */}
      {Object.entries(byCategory).map(([cat, actions]) => (
        <section key={cat} className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span>{cat.replace(/_/g, "-")}</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-400 tabular-nums">{actions.length}</span>
          </p>
          <h2 className="text-[18px] font-semibold text-white tracking-[-0.01em] mb-4">{CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}</h2>
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {actions.map((a) => {
              const tone = STATUS_TONE[a.wireStatus];
              const Icon = STATUS_ICON[a.wireStatus];
              const surface = surfaceForAction(a.kind);
              const clickable = !!surface && (a.wireStatus === "live" || a.wireStatus === "preview");
              const matrixSummary = matrixSummaryForAction(a);
              const rowInner = (
                <div className="flex items-start gap-3 mb-2">
                  <Icon className={`h-4 w-4 ${tone.text} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                      <p className="text-[14px] font-medium text-white">{a.label}</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
                        <span className={tone.text}>{STATUS_LABEL[a.wireStatus]}</span>
                        <span className="text-zinc-700">·</span>
                        <span className={SAFETY_TONE[a.safetyTier]}>{SAFETY_LABEL[a.safetyTier]}</span>
                      </div>
                    </div>
                    <p className="text-[12.5px] text-zinc-400 leading-relaxed">{a.summary}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] font-mono text-zinc-500">
                      <span className="text-zinc-600">kind:</span><span>{a.kind}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-zinc-600">api:</span>
                      <span className="text-zinc-400">{a.method} {a.route}</span>
                      {surface && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-zinc-600">surface:</span>
                          <span className={clickable ? "text-emerald-300" : "text-zinc-400"}>{surface}</span>
                        </>
                      )}
                      {a.requiresConnector && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-zinc-600">connector:</span><span>{a.requiresConnector}</span>
                        </>
                      )}
                      {matrixSummary.total > 0 && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-zinc-600">matrix:</span>
                          <span className={matrixSummary.blocked > 0 ? "text-amber-300" : "text-emerald-300"}>
                            {matrixSummary.passing}/{matrixSummary.total} passing
                            {matrixSummary.blocked > 0 && ` · ${matrixSummary.blocked} blocked`}
                          </span>
                        </>
                      )}
                    </div>
                    {a.blockedReason && (
                      <p className="text-[11.5px] text-rose-200/80 leading-relaxed mt-2 font-mono">
                        blocked :: {a.blockedReason}
                      </p>
                    )}
                    <p className="text-[10.5px] text-zinc-600 mt-1.5 font-mono break-all">evidence :: {a.evidence}</p>
                  </div>
                </div>
              );
              return (
                <li key={a.kind}>
                  {clickable && surface ? (
                    <Link href={surface} className="block px-5 py-4 hover:bg-white/[0.02] transition-colors">
                      {rowInner}
                    </Link>
                  ) : (
                    <div className="px-5 py-4">{rowInner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <footer className="mt-12 pt-6 border-t border-white/[0.06]">
        <p className="text-[11.5px] text-zinc-500 leading-relaxed">
          <BoltIcon className="h-3.5 w-3.5 inline-block -mt-0.5 mr-1 text-emerald-300" />
          Registry is metadata-only. Each route is independently implemented. Honesty is enforced by{" "}
          <code className="text-zinc-400 font-mono text-[11px]">lib/readiness/productHonestyChecks.ts</code> — claims like
          &quot;fully autonomous&quot; or &quot;auto-applied&quot; fail regression tests at build time.
        </p>
      </footer>
    </div>
  );
}
