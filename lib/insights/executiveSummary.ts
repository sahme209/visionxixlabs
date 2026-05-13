/**
 * Executive operational summary engine.
 *
 * Produces concise, structured weekly summaries from operational memory:
 * what changed, what risks moved, what costs improved, what's waiting,
 * what failed, what's improving, what leadership should know, what to do next.
 */

import type { MemoryStore } from "@/lib/memory/operationalMemory";
import type { OrganizationContext } from "@/lib/memory/orgContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SummaryBucket =
  | "what_changed"
  | "risks_increased"
  | "costs_improved"
  | "actions_waiting"
  | "things_that_failed"
  | "approvals_pending"
  | "improving"
  | "leadership_brief"
  | "next_best_action";

export interface SummaryHighlight {
  bucket: SummaryBucket;
  headline: string;
  detail: string;
  /** Numeric magnitude when relevant (cost shift, % change, count). */
  metric?: { label: string; value: string; direction?: "up" | "down" | "flat" };
  /** Links the user can follow to act on this highlight. */
  links?: { label: string; href: string }[];
  /** Severity hint for UI emphasis. */
  severity?: "info" | "success" | "warning" | "critical";
}

export interface ExecutiveSummary {
  organizationId: string;
  /** ISO timestamp for the start of the summary window. */
  windowStart: string;
  /** ISO timestamp for the end of the summary window. */
  windowEnd: string;
  /** Number of operational events in the window. */
  eventsInWindow: number;
  /** Bucketed highlights — UI renders these as cards. */
  highlights: SummaryHighlight[];
  /** Single-sentence opening line for the report. */
  opener: string;
  /** Single-sentence next-step recommendation. */
  recommendedNextStep: string;
  /** Maturity snapshot at summary time. */
  maturity: {
    cloud: number;
    releaseOps: number;
    governance: number;
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export interface SummaryOptions {
  /** Window in days. Default 7 (weekly summary). */
  windowDays?: number;
}

export async function generateExecutiveSummary(
  organizationId: string,
  store: MemoryStore,
  orgContext: OrganizationContext,
  options: SummaryOptions = {}
): Promise<ExecutiveSummary> {
  const windowDays = options.windowDays ?? 7;
  const windowMs = windowDays * 86_400_000;
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const windowEnd = new Date().toISOString();

  const records = await store.query({ organizationId, sinceISO: windowStart, limit: 2000 });

  const highlights: SummaryHighlight[] = [];

  // What changed
  const scans = records.filter((r) => r.kind === "scan.completed").length;
  const applies = records.filter((r) => r.kind === "execution.applied").length;
  if (scans > 0) {
    highlights.push({
      bucket: "what_changed",
      headline: `${scans} scan${scans !== 1 ? "s" : ""} completed · ${applies} change${applies !== 1 ? "s" : ""} applied`,
      detail: `Active operational cycle. Operational memory grew by ${records.length} events this window.`,
      metric: { label: "Events", value: `${records.length}`, direction: "up" },
      severity: "info",
      links: [
        { label: "Open Command Center", href: "/dashboard/command-center" },
        { label: "View memory timeline", href: "/dashboard/memory" },
      ],
    });
  }

  // Risks increased
  const failures = records.filter((r) => r.kind === "execution.failed" || r.kind === "verification.failed" || r.kind === "rollback.executed").length;
  const drift = records.filter((r) => r.kind === "drift.detected").length;
  if (failures + drift > 0) {
    highlights.push({
      bucket: "risks_increased",
      headline: `${failures + drift} risk event${failures + drift !== 1 ? "s" : ""} this window`,
      detail: `${failures} execution / verification failure${failures !== 1 ? "s" : ""} · ${drift} drift event${drift !== 1 ? "s" : ""}.`,
      metric: { label: "Risk events", value: `${failures + drift}`, direction: failures + drift > 5 ? "up" : "flat" },
      severity: failures + drift > 5 ? "warning" : "info",
      links: [
        { label: "Review failures", href: "/dashboard/memory" },
        { label: "Read troubleshooting", href: "/docs/troubleshooting" },
      ],
    });
  }

  // Costs improved
  const savings = records.reduce((s, r) => s + ((r.impact.costDeltaUsd ?? 0) > 0 ? (r.impact.costDeltaUsd ?? 0) : 0), 0);
  if (savings > 0) {
    highlights.push({
      bucket: "costs_improved",
      headline: `$${Math.round(savings).toLocaleString()} in monthly savings locked`,
      detail: `Cost shifts from applied recommendations confirmed by post-execution verification.`,
      metric: { label: "Monthly savings", value: `+$${Math.round(savings).toLocaleString()}`, direction: "up" },
      severity: "success",
    });
  }

  // Actions waiting
  const pendingApprovals = records.filter((r) => r.kind === "approval.granted" || r.kind === "approval.denied").length;
  const expiredApprovals = records.filter((r) => r.kind === "approval.expired").length;
  if (expiredApprovals > 0) {
    highlights.push({
      bucket: "actions_waiting",
      headline: `${expiredApprovals} approval${expiredApprovals !== 1 ? "s" : ""} expired`,
      detail: `Plans expired before approval. Re-scan to regenerate against current state.`,
      severity: "warning",
      links: [{ label: "Open Approvals", href: "/dashboard/approvals" }],
    });
  }

  // Approvals pending
  if (pendingApprovals > 0) {
    highlights.push({
      bucket: "approvals_pending",
      headline: `${pendingApprovals} approval${pendingApprovals !== 1 ? "s" : ""} processed`,
      detail: `Active approval discipline reflects in operational memory.`,
      severity: "success",
    });
  }

  // Improving — confidence trend positive
  const positiveConf = records.filter((r) => (r.impact.confidenceDelta ?? 0) > 0).length;
  const negativeConf = records.filter((r) => (r.impact.confidenceDelta ?? 0) < 0).length;
  if (positiveConf > negativeConf) {
    highlights.push({
      bucket: "improving",
      headline: `Agent confidence trending up`,
      detail: `${positiveConf} positive confidence event${positiveConf !== 1 ? "s" : ""} vs ${negativeConf} negative. Operational outcomes are validating the agent's reasoning.`,
      metric: { label: "Confidence delta", value: `${positiveConf - negativeConf} pts`, direction: "up" },
      severity: "success",
    });
  }

  // Leadership brief — single sentence
  const recurring = orgContext.recurringProblemResources.length;
  if (recurring > 0) {
    highlights.push({
      bucket: "leadership_brief",
      headline: `${recurring} resource${recurring !== 1 ? "s require" : " requires"} attention`,
      detail: `Repeatedly problematic resources should be reviewed at the service-ownership level. Operational memory will continue to surface them until addressed.`,
      severity: "warning",
      links: [{ label: "Open Topology", href: "/dashboard/topology" }],
    });
  }

  // Next best action
  const nextAction: SummaryHighlight = {
    bucket: "next_best_action",
    headline: pickNextAction(records, orgContext),
    detail: "Derived from operational memory + current maturity profile.",
    severity: "info",
    links: [{ label: "Open Command Center", href: "/dashboard/command-center" }],
  };
  highlights.push(nextAction);

  return {
    organizationId,
    windowStart,
    windowEnd,
    eventsInWindow: records.length,
    highlights,
    opener: buildOpener(records.length, applies, scans),
    recommendedNextStep: nextAction.headline,
    maturity: {
      cloud: orgContext.cloudMaturity.score,
      releaseOps: orgContext.releaseOpsMaturity.score,
      governance: orgContext.governanceMaturity.score,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildOpener(events: number, applies: number, scans: number): string {
  if (events === 0) return "Quiet operational window — no events recorded.";
  if (applies > 0 && scans > 0) return `${events} operational events this window — ${scans} scan${scans !== 1 ? "s" : ""}, ${applies} change${applies !== 1 ? "s" : ""} applied.`;
  if (scans > 0) return `${events} operational events this window — ${scans} scan${scans !== 1 ? "s" : ""} observed, no changes applied.`;
  return `${events} operational events this window.`;
}

import type { MemoryRecord } from "@/lib/memory/operationalMemory";

function pickNextAction(records: MemoryRecord[], orgContext: OrganizationContext): string {
  if (orgContext.connectedProviders.length === 0) return "Connect AWS to start your first scan.";
  if (records.length === 0) return "Trigger a scan — operational memory is empty.";
  const failures = records.filter((r) => r.kind === "execution.failed" || r.kind === "verification.failed").length;
  if (failures > 0) return `Investigate ${failures} execution failure${failures !== 1 ? "s" : ""} before approving new plans.`;
  if (orgContext.recurringProblemResources.length > 0) return `Address ${orgContext.recurringProblemResources.length} recurring problem resource${orgContext.recurringProblemResources.length !== 1 ? "s" : ""}.`;
  if (orgContext.releaseOpsMaturity.score < 50) return "Connect ReleaseOps to surface release readiness scoring alongside cloud ops.";
  if (orgContext.governanceMaturity.score < 70) return "Tighten approval policy — current governance maturity below target.";
  return "Continue current operational cadence — no immediate action required.";
}
