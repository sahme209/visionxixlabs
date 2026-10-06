/**
 * <ModuleIntro> — Phase 405.
 *
 * Drop-in explainer header that every major dashboard module should
 * render above its real content. Tells a brand-new user, in 6 seconds:
 *
 *   - What this module IS  (one sentence)
 *   - What it HELPS them do (bulleted outcomes)
 *   - What to CONNECT first
 *   - Which AI engineers use this
 *   - Which actions require human approval
 *   - Where to see a DEMO of this in action
 *   - Where to READ docs
 *
 * Designed to feel less like a tutorial and more like a contextual
 * footer-of-the-feature. Operators can collapse it once they're
 * familiar (persists per-module via localStorage).
 *
 * Phase 405 living-docs rule: every entry on a real module page must
 * carry a `lastReviewed` date so the docs/demo team can spot stale
 * explanations during the weekly content review.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type ApprovalSeverity = "read_only" | "soft" | "human_required";

export interface ModuleIntroProps {
  /** Plain-English module title (e.g. "Monitoring & Observability"). */
  title: string;
  /** One-sentence explainer. */
  explanation: string;
  /** Bulleted "what this helps you do" list. Keep each item < 60 chars. */
  helpsYouDo: ReadonlyArray<string>;
  /** Which connectors / agents / data sources to set up first. */
  connectFirst: ReadonlyArray<string>;
  /** Names of AI engineers that operate on this surface. */
  aiEngineers?: ReadonlyArray<string>;
  /** Approval requirements summary. Closed-union severity surfaces a badge. */
  approval?: { severity: ApprovalSeverity; note: string };
  /**
   * Optional demo + docs deep-links.
   * `demoHref` should ALWAYS point to a /demo/* route (sandbox-only data).
   * `docsHref` should always point to /docs/* or /dashboard/help.
   */
  demoHref?: string;
  docsHref?: string;
  /** Phase 405 living-docs metadata. ISO date. */
  lastReviewed?: string;
  /** Module key — used as the localStorage key for dismiss state. */
  storageKey: string;
}

const APPROVAL_LABEL: Record<ApprovalSeverity, { label: string; cls: string }> = {
  read_only:       { label: "Read-only · no approval required", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  soft:            { label: "Soft approval · operator can self-approve", cls: "bg-white/10 text-zinc-300 border-white/30" },
  human_required:  { label: "Two-person human approval required", cls: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
};

export function ModuleIntro(props: ModuleIntroProps) {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const dismissKey = `vxl.moduleIntro.${props.storageKey}.dismissed`;

  useEffect(() => {
    // Hydration-safe: read after mount.
    try {
      if (typeof window !== "undefined") {
        setCollapsed(window.localStorage.getItem(dismissKey) === "1");
      }
    } catch { /* private browsing or quota issue — keep expanded */ }
  }, [dismissKey]);

  const persistCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(dismissKey, next ? "1" : "0");
      }
    } catch { /* best-effort */ }
  };

  if (collapsed) {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em]">module</span>
          <span className="text-[13px] font-semibold text-zinc-200 truncate">{props.title}</span>
        </div>
        <button
          onClick={() => persistCollapsed(false)}
          className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          ↓ show intro
        </button>
      </div>
    );
  }

  const approvalConfig = props.approval ? APPROVAL_LABEL[props.approval.severity] : null;

  return (
    <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">module · what this is</p>
          <h1 className="text-xl font-bold text-white tracking-tight">{props.title}</h1>
          <p className="text-[13px] text-zinc-400 leading-relaxed mt-1 max-w-3xl">{props.explanation}</p>
        </div>
        <button
          onClick={() => persistCollapsed(true)}
          className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors whitespace-nowrap"
        >
          ↑ hide intro
        </button>
      </div>

      {/* Four-column detail block — collapses to one column on mobile. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <IntroBlock label="What this helps you do" items={props.helpsYouDo} />
        <IntroBlock label="Connect first" items={props.connectFirst} />
        {props.aiEngineers && props.aiEngineers.length > 0 && (
          <IntroBlock label="AI engineers" items={props.aiEngineers} />
        )}
        {approvalConfig && (
          <div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">approval</p>
            <span className={`inline-block text-[11px] font-mono px-2 py-1 rounded-md border ${approvalConfig.cls}`}>
              {approvalConfig.label}
            </span>
            {props.approval?.note && (
              <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">{props.approval.note}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer CTAs */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-2">
          {props.demoHref && (
            <Link
              href={props.demoHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-500/[0.10] text-violet-200 text-[11px] font-medium hover:bg-violet-500/[0.18] border border-violet-500/20 transition-colors"
            >
              <SparkleIcon className="h-3 w-3" />
              View demo
            </Link>
          )}
          {props.docsHref && (
            <Link
              href={props.docsHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] text-zinc-200 text-[11px] font-medium hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
            >
              <BookIcon className="h-3 w-3" />
              Read documentation
            </Link>
          )}
        </div>
        {props.lastReviewed && (
          <span className="text-[10px] font-mono text-zinc-600">
            last reviewed · {props.lastReviewed}
          </span>
        )}
      </div>
    </section>
  );
}

function IntroBlock({ label, items }: { label: string; items: ReadonlyArray<string> }) {
  return (
    <div>
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[12px] text-zinc-300 leading-relaxed flex items-start gap-1.5">
            <span className="text-zinc-600 mt-1">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.91 5.91L4 10l5.91 1.91L12 18l1.91-5.91L20 10l-5.91-1.91L12 3z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
