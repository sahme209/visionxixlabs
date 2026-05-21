/**
 * Pure postmortem drafter.
 *
 * Input: an IncidentTimeline (from incidentTimelineWeaver) + a few
 * operator-supplied fields (severity, impact, contributing factors).
 * Output: a typed Postmortem doc — markdown body + structured fields
 * the cockpit can index for trend analysis.
 *
 * No I/O. The auditor downstream computes a sha-256 of the canonical
 * postmortem so future amendments are detectable.
 *
 * Closed unions on severity + action-item kind so future shapes break
 * the build.
 */

import { renderTimelineMarkdown, type IncidentTimeline } from "./incidentTimelineWeaver";

export type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";

export type ActionItemKind =
  | "prevention"
  | "detection"
  | "mitigation"
  | "documentation"
  | "process";

export interface ActionItem {
  id: string;
  kind: ActionItemKind;
  owner: string;
  /** Concise statement of what will be done. */
  statement: string;
  /** ISO date the item is due, or null when unscheduled. */
  dueAt: string | null;
}

export interface PostmortemInput {
  /** Public incident id (e.g. INC-509). */
  incidentId: string;
  /** One-line title. */
  title: string;
  severity: IncidentSeverity;
  /** Two-sentence customer-facing impact statement. */
  impact: string;
  /** What was the root cause, in operator words. */
  rootCause: string;
  /** Factors that made the incident worse. */
  contributingFactors: readonly string[];
  /** The timeline assembled by incidentTimelineWeaver. */
  timeline: IncidentTimeline;
  /** Action items the team commits to. */
  actionItems: readonly ActionItem[];
  /** Operator drafting the postmortem (audit). */
  authorEmail: string;
}

export interface PostmortemDraft {
  /** The markdown body — ready to share. */
  markdown: string;
  /** Structured fields the cockpit indexes. */
  fields: {
    incidentId: string;
    severity: IncidentSeverity;
    ttdMinutes: number | null;
    ttmMinutes: number | null;
    ttrMinutes: number | null;
    totalOutageMinutes: number | null;
    actionItemCount: number;
    actionItemsByKind: Readonly<Record<ActionItemKind, number>>;
    hasBreakingActionItems: boolean;
  };
  /** Verdict — closed-union: ready_for_review / needs_more_data / blocked. */
  verdict: "ready_for_review" | "needs_more_data" | "blocked";
  /** Why this verdict was chosen. */
  rationale: string;
}

export class PostmortemValidationError extends Error {}

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  sev1: "SEV1 · customer-impacting outage",
  sev2: "SEV2 · partial outage or major degradation",
  sev3: "SEV3 · minor degradation",
  sev4: "SEV4 · internal-only / no customer impact",
};

function fmt(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return `<1m`;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return `${h}h ${m}m`;
}

export function draftPostmortem(input: PostmortemInput): PostmortemDraft {
  // ── Validate ─────────────────────────────────────────────────
  if (!input.incidentId.trim()) throw new PostmortemValidationError("incidentId is required");
  if (!input.title.trim()) throw new PostmortemValidationError("title is required");
  if (!input.impact.trim()) throw new PostmortemValidationError("impact is required");
  if (!input.rootCause.trim()) throw new PostmortemValidationError("rootCause is required");
  if (!input.authorEmail.trim()) throw new PostmortemValidationError("authorEmail is required");

  const t = input.timeline;

  // ── Structured fields ────────────────────────────────────────
  const actionItemsByKind: Record<ActionItemKind, number> = {
    prevention: 0, detection: 0, mitigation: 0, documentation: 0, process: 0,
  };
  for (const a of input.actionItems) actionItemsByKind[a.kind] += 1;
  const hasBreakingActionItems = input.actionItems.some(
    (a) => a.kind === "prevention" && (!a.owner || !a.dueAt),
  );

  const fields: PostmortemDraft["fields"] = {
    incidentId: input.incidentId,
    severity: input.severity,
    ttdMinutes: t.durations.ttdMinutes,
    ttmMinutes: t.durations.ttmMinutes,
    ttrMinutes: t.durations.ttrMinutes,
    totalOutageMinutes: t.durations.totalOutageMinutes,
    actionItemCount: input.actionItems.length,
    actionItemsByKind,
    hasBreakingActionItems,
  };

  // ── Verdict ──────────────────────────────────────────────────
  let verdict: PostmortemDraft["verdict"];
  let rationale: string;
  if (t.finalState === "ongoing") {
    verdict = "blocked";
    rationale = "Incident has no recovery event — postmortem is premature. Resolve first, then draft.";
  } else if (t.finalState === "no_signal") {
    verdict = "blocked";
    rationale = "No timeline events — there is nothing to draft a postmortem about.";
  } else if (hasBreakingActionItems) {
    verdict = "needs_more_data";
    rationale = "At least one prevention action item is missing an owner or due date — postmortem cannot be merged until those are filled in.";
  } else if (input.actionItems.length === 0) {
    verdict = "needs_more_data";
    rationale = "No action items recorded. Every incident produces at least one improvement — add one before review.";
  } else {
    verdict = "ready_for_review";
    rationale = `${input.actionItems.length} action items recorded across ${Object.values(actionItemsByKind).filter((v) => v > 0).length} categories. Timeline is complete.`;
  }

  // ── Markdown assembly ────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`# ${input.incidentId} · ${input.title}`);
  lines.push("");
  lines.push(`> **Severity:** ${SEVERITY_LABEL[input.severity]}`);
  lines.push(`> **Author:** ${input.authorEmail}`);
  lines.push("");

  lines.push(`## Impact`);
  lines.push(input.impact.trim());
  lines.push("");

  lines.push(`## Key durations`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Time to detect (TTD) | ${fmt(t.durations.ttdMinutes)} |`);
  lines.push(`| Time to mitigate (TTM) | ${fmt(t.durations.ttmMinutes)} |`);
  lines.push(`| Time to recover (TTR) | ${fmt(t.durations.ttrMinutes)} |`);
  lines.push(`| Total outage | ${fmt(t.durations.totalOutageMinutes)} |`);
  lines.push("");

  lines.push(`## Root cause`);
  lines.push(input.rootCause.trim());
  lines.push("");

  if (input.contributingFactors.length > 0) {
    lines.push(`## Contributing factors`);
    for (const f of input.contributingFactors) lines.push(`- ${f}`);
    lines.push("");
  }

  lines.push(`## Timeline`);
  lines.push(renderTimelineMarkdown(t));
  lines.push("");

  lines.push(`## Action items`);
  if (input.actionItems.length === 0) {
    lines.push("_None recorded yet._");
  } else {
    lines.push(`| # | Kind | Owner | Statement | Due |`);
    lines.push(`|---|---|---|---|---|`);
    for (const a of input.actionItems) {
      lines.push(`| ${a.id} | ${a.kind} | ${a.owner || "_unassigned_"} | ${a.statement} | ${a.dueAt ?? "_unscheduled_"} |`);
    }
  }
  lines.push("");

  lines.push(`## Verdict`);
  lines.push(`> ${verdict} — ${rationale}`);

  return {
    markdown: lines.join("\n").trim(),
    fields,
    verdict,
    rationale,
  };
}
