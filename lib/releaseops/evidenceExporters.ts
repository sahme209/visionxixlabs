/**
 * Phase 449 — evidence pack exporters.
 *
 * Pure functions: given a Release row, its latest readiness snapshot,
 * and its sealed/unsealed evidence pack, produce serialized exports in
 * Markdown and JSON. PDF + DOCX exporters land in a focused phase
 * (they need a real renderer; MD + JSON cover the audit + ticket-
 * attachment paths today).
 *
 * No I/O. No Prisma. The route handler reads the rows and passes
 * them in; this module just formats.
 */

import type {
  ReleaseRow,
  ReleaseReadinessSnapshotRow,
  ReleaseEvidencePackRow,
} from "./releaseRepo";

/* ──────────────────────────────────────────────────────────────────
   Input shape — what the exporter consumes.
   ────────────────────────────────────────────────────────────── */

export interface EvidenceExportInput {
  release: ReleaseRow;
  /** Latest readiness snapshot (newest-first first row). Null if never evaluated. */
  latestReadiness: ReleaseReadinessSnapshotRow | null;
  /** The evidence pack. Null when no pack has been created yet. */
  evidencePack: ReleaseEvidencePackRow | null;
}

/* ──────────────────────────────────────────────────────────────────
   JSON exporter — canonical machine-readable shape.
   ────────────────────────────────────────────────────────────── */

export interface ExportedJson {
  schemaVersion: 1;
  generatedAtIso: string;
  release: {
    id: string;
    organizationId: string;
    applicationId: string;
    status: ReleaseRow["status"];
    releaseTag: string | null;
    commitSha: string | null;
    targetEnvironmentId: string | null;
    plannedWindowStartIso: string | null;
    plannedWindowEndIso: string | null;
    actualDeployStartIso: string | null;
    actualDeployEndIso: string | null;
    scopeFinalizedAtIso: string | null;
    scopeFinalizedByUserId: string | null;
    rollbackReferenceReleaseId: string | null;
    summary: string | null;
  };
  readiness: {
    overallScore: number;
    riskLevel: string;
    branchGovernance: number;
    changeCompliance: number;
    artifactTraceability: number;
    secretTraceability: number;
    rollbackReadiness: number;
    communicationReadiness: number;
    driftRisk: number;
    manualReconciliation: number;
    blockers: ReadonlyArray<{
      id: string;
      category: string;
      severity: string;
      message: string;
      remediation?: string;
    }>;
    evaluatedAtIso: string;
    evaluationSource: string;
  } | null;
  evidencePack: {
    generatedAtIso: string;
    signedAtIso: string | null;
    contentHash: string | null;
    content: Record<string, unknown>;
    exportRefs: Record<string, string> | null;
  } | null;
  disclaimer: string;
}

export const EVIDENCE_EXPORT_DISCLAIMER =
  "This evidence pack represents the state at generatedAtIso. Audit-of-audit rules require the underlying " +
  "Release + ReleaseReadinessSnapshot + ReleaseEvidencePack rows be preserved immutably. If signedAtIso is " +
  "null, the pack is a draft and the content may change before sealing.";

export function exportEvidenceAsJson(input: EvidenceExportInput, now: Date = new Date()): ExportedJson {
  return {
    schemaVersion: 1,
    generatedAtIso: now.toISOString(),
    release: {
      id: input.release.id,
      organizationId: input.release.organizationId,
      applicationId: input.release.applicationId,
      status: input.release.status,
      releaseTag: input.release.releaseTag,
      commitSha: input.release.commitSha,
      targetEnvironmentId: input.release.targetEnvironmentId,
      plannedWindowStartIso: isoOrNull(input.release.plannedWindowStart),
      plannedWindowEndIso: isoOrNull(input.release.plannedWindowEnd),
      actualDeployStartIso: isoOrNull(input.release.actualDeployStart),
      actualDeployEndIso: isoOrNull(input.release.actualDeployEnd),
      scopeFinalizedAtIso: isoOrNull(input.release.scopeFinalizedAt),
      scopeFinalizedByUserId: input.release.scopeFinalizedByUserId,
      rollbackReferenceReleaseId: input.release.rollbackReferenceReleaseId,
      summary: input.release.summary,
    },
    readiness: input.latestReadiness
      ? {
          overallScore: input.latestReadiness.overallScore,
          riskLevel: input.latestReadiness.riskLevel,
          branchGovernance: input.latestReadiness.branchGovernance,
          changeCompliance: input.latestReadiness.changeCompliance,
          artifactTraceability: input.latestReadiness.artifactTraceability,
          secretTraceability: input.latestReadiness.secretTraceability,
          rollbackReadiness: input.latestReadiness.rollbackReadiness,
          communicationReadiness: input.latestReadiness.communicationReadiness,
          driftRisk: input.latestReadiness.driftRisk,
          manualReconciliation: input.latestReadiness.manualReconciliation,
          blockers: input.latestReadiness.blockersJson,
          evaluatedAtIso: input.latestReadiness.evaluatedAt.toISOString(),
          evaluationSource: input.latestReadiness.evaluationSource,
        }
      : null,
    evidencePack: input.evidencePack
      ? {
          generatedAtIso: input.evidencePack.generatedAt.toISOString(),
          signedAtIso: isoOrNull(input.evidencePack.signedAt),
          contentHash: input.evidencePack.contentHash,
          content: input.evidencePack.contentJson,
          exportRefs: input.evidencePack.exportRefsJson,
        }
      : null,
    disclaimer: EVIDENCE_EXPORT_DISCLAIMER,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Markdown exporter — auditor-readable form.
   ────────────────────────────────────────────────────────────── */

export function exportEvidenceAsMarkdown(input: EvidenceExportInput, now: Date = new Date()): string {
  const { release, latestReadiness, evidencePack } = input;
  const lines: string[] = [];

  const tag = release.releaseTag ?? "(no tag)";
  lines.push(`# Release Evidence Pack — ${tag}`);
  lines.push("");
  lines.push(`_Generated ${now.toISOString()}_`);
  lines.push("");

  lines.push("## Release");
  lines.push("");
  lines.push(`- **ID:** \`${release.id}\``);
  lines.push(`- **Application:** \`${release.applicationId}\``);
  lines.push(`- **Status:** ${release.status}`);
  lines.push(`- **Release tag:** ${release.releaseTag ?? "_(none)_"}`);
  lines.push(`- **Commit SHA:** ${release.commitSha ? `\`${release.commitSha}\`` : "_(none)_"}`);
  lines.push(`- **Target environment:** ${release.targetEnvironmentId ?? "_(none)_"}`);
  if (release.scopeFinalizedAt) {
    lines.push(`- **Scope finalized:** ${release.scopeFinalizedAt.toISOString()} by ${release.scopeFinalizedByUserId ?? "_(system)_"}`);
  }
  if (release.plannedWindowStart || release.plannedWindowEnd) {
    lines.push(`- **Planned window:** ${isoOrDash(release.plannedWindowStart)} → ${isoOrDash(release.plannedWindowEnd)}`);
  }
  if (release.actualDeployStart || release.actualDeployEnd) {
    lines.push(`- **Actual deploy:** ${isoOrDash(release.actualDeployStart)} → ${isoOrDash(release.actualDeployEnd)}`);
  }
  if (release.rollbackReferenceReleaseId) {
    lines.push(`- **Rollback reference:** \`${release.rollbackReferenceReleaseId}\``);
  }
  if (release.summary) {
    lines.push("");
    lines.push(`> ${release.summary}`);
  }
  lines.push("");

  lines.push("## Readiness");
  lines.push("");
  if (!latestReadiness) {
    lines.push("_No readiness evaluation has been persisted for this release yet._");
  } else {
    lines.push(`- **Overall score:** ${latestReadiness.overallScore}/100 · **risk:** ${latestReadiness.riskLevel}`);
    lines.push(`- **Evaluated at:** ${latestReadiness.evaluatedAt.toISOString()} (source: ${latestReadiness.evaluationSource})`);
    lines.push("");
    lines.push("| Dimension | Score |");
    lines.push("|---|---|");
    lines.push(`| Branch governance        | ${latestReadiness.branchGovernance} |`);
    lines.push(`| Change compliance        | ${latestReadiness.changeCompliance} |`);
    lines.push(`| Artifact traceability    | ${latestReadiness.artifactTraceability} |`);
    lines.push(`| Secret traceability      | ${latestReadiness.secretTraceability} |`);
    lines.push(`| Rollback readiness       | ${latestReadiness.rollbackReadiness} |`);
    lines.push(`| Communication readiness  | ${latestReadiness.communicationReadiness} |`);
    lines.push(`| Drift risk               | ${latestReadiness.driftRisk} |`);
    lines.push(`| Manual reconciliation    | ${latestReadiness.manualReconciliation} |`);
    lines.push("");
    if (latestReadiness.blockersJson.length > 0) {
      lines.push("### Blockers");
      lines.push("");
      for (const b of latestReadiness.blockersJson) {
        lines.push(`- **[${b.severity}] ${b.category}** — ${b.message}` + (b.remediation ? `  \n  _Remediation:_ ${b.remediation}` : ""));
      }
      lines.push("");
    } else {
      lines.push("_No blockers at last evaluation._");
      lines.push("");
    }
  }

  lines.push("## Evidence Pack");
  lines.push("");
  if (!evidencePack) {
    lines.push("_No evidence pack has been created for this release yet._");
  } else {
    lines.push(`- **Generated:** ${evidencePack.generatedAt.toISOString()}`);
    lines.push(`- **Signed:** ${evidencePack.signedAt ? evidencePack.signedAt.toISOString() : "_unsigned draft_"}`);
    if (evidencePack.contentHash) {
      lines.push(`- **Content hash (SHA-256):** \`${evidencePack.contentHash}\``);
    }
    lines.push("");
    lines.push("### Content");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(evidencePack.contentJson, null, 2));
    lines.push("```");
    lines.push("");
    if (evidencePack.exportRefsJson && Object.keys(evidencePack.exportRefsJson).length > 0) {
      lines.push("### Pre-generated export refs");
      lines.push("");
      for (const [fmt, ref] of Object.entries(evidencePack.exportRefsJson)) {
        lines.push(`- **${fmt}:** ${ref}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(`_${EVIDENCE_EXPORT_DISCLAIMER}_`);
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────
   Format dispatch.
   ────────────────────────────────────────────────────────────── */

export type EvidenceExportFormat = "json" | "markdown";

export interface ExportedEvidence {
  format: EvidenceExportFormat;
  contentType: string;
  body: string;
  /** Recommended filename for download. */
  filename: string;
}

export function exportEvidence(
  input: EvidenceExportInput,
  format: EvidenceExportFormat,
  now: Date = new Date(),
): ExportedEvidence {
  const tag = input.release.releaseTag ?? input.release.id;
  if (format === "json") {
    const json = exportEvidenceAsJson(input, now);
    return {
      format: "json",
      contentType: "application/json",
      body: JSON.stringify(json, null, 2),
      filename: `release-evidence-${tag}.json`,
    };
  }
  const md = exportEvidenceAsMarkdown(input, now);
  return {
    format: "markdown",
    contentType: "text/markdown; charset=utf-8",
    body: md,
    filename: `release-evidence-${tag}.md`,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function isoOrDash(d: Date | null): string {
  return d ? d.toISOString() : "—";
}
