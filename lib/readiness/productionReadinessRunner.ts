/**
 * Production readiness runner.
 *
 * Aggregates the platform's current state into a single typed
 * `ProductionReadinessReport`. The runner is **pure read-only** — it
 * never mutates, never executes a destructive task, and never makes a
 * cloud API call. Safe to run from any route, server action, or scheduled
 * job.
 *
 * Sources of truth queried:
 *   1. `VALIDATION_MATRIX` (`lib/validation/platformValidationMatrix.ts`)
 *   2. `buildAllOperatingLoops` (`lib/operatingLoop/operatingLoopBuilder.ts`)
 *   3. `loadAppEnv` (`lib/config/env.ts`)
 *   4. `auditAllExhaustiveness` (`./exhaustivenessChecks`)
 *   5. `scanProductHonesty` (`./productHonestyChecks`)
 */

import "server-only";

import { VALIDATION_MATRIX } from "@/lib/validation/platformValidationMatrix";
import type { ValidationRow } from "@/lib/validation/platformValidationMatrix";
import { buildAllOperatingLoops } from "@/lib/operatingLoop/operatingLoopBuilder";
import { loadAppEnv } from "@/lib/config/env";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

import {
  CATEGORY_LABEL,
  computeOverallScore,
  summariseByCategory,
  type CategoryScore,
  type ProductionReadinessReport,
  type ReadinessCategory,
  type ReadinessCheck,
  type ReadinessSeverity,
  type ReadinessStatus,
} from "./productionReadinessModel";
import { auditAllExhaustiveness } from "./exhaustivenessChecks";
import { scanProductHonesty } from "./productHonestyChecks";

export interface RunReadinessInput {
  organizationId: OrganizationId;
  actorUserId?: UserId;
}

export async function runProductionReadiness(input: RunReadinessInput): Promise<ProductionReadinessReport> {
  const generatedAt = new Date().toISOString();
  const checks: ReadinessCheck[] = [];

  // 1) Validation matrix → readiness checks
  for (const row of VALIDATION_MATRIX) {
    checks.push(fromValidationRow(row, generatedAt));
  }

  // 2) Exhaustiveness audit — catches the enum-cascade class of bugs.
  for (const result of auditAllExhaustiveness()) {
    checks.push({
      id: `exhaust.${result.recordName}`,
      category: "type_safety",
      title: `Exhaustive coverage of ${result.recordName}`,
      status: result.ok ? "passing" : "failing",
      severity: result.ok ? "low" : "high",
      evidence: result.ok
        ? `${result.recordName} covers ${result.size} keys.`
        : `${result.recordName} missing=[${result.missing.join(", ")}] extra=[${result.extra.join(", ")}]`,
      affectedFiles: ["lib/securityScanner/securityScanner.ts"],
      nextFix: result.ok
        ? undefined
        : `Add missing keys to ${result.recordName} or remove the unused enum values.`,
      sourceMode: "live",
      lastCheckedAt: generatedAt,
    });
  }

  // 3) Product-honesty scan — flags risky claims in source content.
  const honestyResults = await scanProductHonesty();
  for (const r of honestyResults) {
    checks.push({
      id: `honesty.${r.id}`,
      category: "product_honesty_readiness",
      title: r.title,
      status: r.severity === "high" ? "failing" : "preview",
      severity: r.severity,
      evidence: `${r.file}:${r.line} — "${r.snippet}"`,
      affectedFiles: [r.file],
      nextFix: r.suggestion,
      sourceMode: "live",
      lastCheckedAt: generatedAt,
    });
  }

  // 4) Operating-loop builder — provider readiness derived from real
  //    subsystem state. Failures here mean a provider can't progress.
  const env = loadAppEnv();
  try {
    const loops = await buildAllOperatingLoops({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
    for (const loop of loops) {
      const isHonestLive = loop.sourceMode === "live";
      const advancedStages = loop.stages.filter((s) => s.status === "passing" || s.status === "completed").length;
      const totalStages = loop.stages.filter((s) => s.status !== "skipped").length;
      const ratio = totalStages === 0 ? 0 : advancedStages / totalStages;
      let status: ReadinessStatus;
      if (ratio >= 0.85) status = "passing";
      else if (ratio >= 0.5) status = "partial";
      else if (isHonestLive) status = "partial";
      else status = "preview";
      checks.push({
        id: `loop.${loop.provider}`,
        category: "operating_loop_readiness",
        title: `Operating loop for ${loop.provider}`,
        status,
        severity: loop.provider === "aws" ? "high" : "medium",
        evidence: loop.summary,
        affectedRoutes: ["/api/operating-loop/state", "/api/operating-loop/run"],
        sourceMode: loop.sourceMode === "expanding" || loop.sourceMode === "unknown" ? "preview" : loop.sourceMode,
        nextFix: loop.attentionRequired[0]?.reason ?? loop.topSafeNextAction?.label,
        lastCheckedAt: generatedAt,
      });
    }
  } catch (err) {
    checks.push({
      id: "loop.builder_failed",
      category: "operating_loop_readiness",
      title: "Operating loop builder errored",
      status: "failing",
      severity: "critical",
      evidence: err instanceof Error ? err.message : "Builder threw an unknown error.",
      sourceMode: "unknown",
      lastCheckedAt: generatedAt,
    });
  }

  // 5) Persistence presence — DATABASE_URL drives live audit/memory/etc.
  checks.push({
    id: "persistence.database_url",
    category: "persistence_readiness",
    title: "DATABASE_URL configured",
    status: env.databaseUrlSet ? "passing" : "preview",
    severity: env.databaseUrlSet ? "low" : "high",
    evidence: env.databaseUrlSet
      ? "Prisma client + persistence adapters active via storeFactory."
      : "Audit / memory / desktop sessions run on in-memory stores — ephemeral.",
    affectedFiles: ["lib/platform/storeFactory.ts", "instrumentation.ts"],
    nextFix: env.databaseUrlSet ? undefined : "Set DATABASE_URL on the host and run `prisma migrate deploy`.",
    sourceMode: env.databaseUrlSet ? "live" : "preview",
    lastCheckedAt: generatedAt,
  });

  // 6) NextAuth secret — required for desktop signing fallback + sessions.
  checks.push({
    id: "auth.nextauth_secret",
    category: "security_readiness",
    title: "NEXTAUTH_SECRET configured",
    status: env.nextAuthSecret ? "passing" : "failing",
    severity: "critical",
    evidence: env.nextAuthSecret
      ? "Server-side secret available (used by NextAuth + as desktop signing fallback)."
      : "NEXTAUTH_SECRET unset — auth + desktop signing will refuse to mint tokens.",
    nextFix: env.nextAuthSecret ? undefined : "Set NEXTAUTH_SECRET ≥ 32 chars on the host.",
    sourceMode: "live",
    lastCheckedAt: generatedAt,
  });

  // 7) Composite scoring + sorting
  const categoryScores = summariseByCategory(checks);
  const overallScore = computeOverallScore(categoryScores);

  const criticalFailures = checks.filter((c) => c.status === "failing" && c.severity === "critical");
  const highRiskGaps    = checks.filter((c) => (c.status === "failing" || c.status === "blocked") && c.severity === "high");
  const previewOnlyAreas = checks.filter((c) => c.status === "preview");
  const blockedAreas     = checks.filter((c) => c.status === "blocked");

  const recommendedNextFixes = pickNextFixes(checks);

  return {
    generatedAt,
    overallScore,
    categoryScores,
    checks,
    criticalFailures,
    highRiskGaps,
    previewOnlyAreas,
    blockedAreas,
    recommendedNextFixes,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromValidationRow(row: ValidationRow, now: string): ReadinessCheck {
  return {
    id: `matrix.${row.id}`,
    category: categoryFromMatrixArea(row.area),
    title: row.capability,
    status: statusFromMatrix(row.status),
    severity: severityFromMatrix(row.status, row.area),
    evidence: row.evidence,
    nextFix: row.nextFix,
    sourceMode: row.status === "passing" ? "live" : row.status === "partial" ? "partial" : "preview",
    lastCheckedAt: now,
  };
}

function statusFromMatrix(s: ValidationRow["status"]): ReadinessStatus {
  switch (s) {
    case "passing":  return "passing";
    case "partial":  return "partial";
    case "preview":  return "preview";
    case "blocked":  return "blocked";
    case "failing":  return "failing";
  }
}

function severityFromMatrix(s: ValidationRow["status"], area: ValidationRow["area"]): ReadinessSeverity {
  if (s === "failing") return "critical";
  if (area === "security_scanner" && (s === "blocked" || s === "preview")) return "high";
  if (area === "operating_loop") return "high";
  if (s === "blocked") return "high";
  if (s === "partial") return "medium";
  if (s === "preview") return "low";
  return "low";
}

function categoryFromMatrixArea(area: ValidationRow["area"]): ReadinessCategory {
  switch (area) {
    case "aws":
    case "azure":
    case "gcp":
    case "github":           return "provider_readiness";
    case "security_scanner": return "security_readiness";
    case "desktop":          return "desktop_readiness";
    case "command_center":   return "operating_loop_readiness";
    case "operating_loop":   return "operating_loop_readiness";
    case "compliance":       return "audit_trace_readiness";
    case "release":          return "remediation_readiness";
  }
}

function pickNextFixes(checks: ReadinessCheck[]): ProductionReadinessReport["recommendedNextFixes"] {
  const ranked = [...checks]
    .filter((c) => c.status === "failing" || c.status === "blocked" || (c.status === "partial" && c.severity !== "low"))
    .sort((a, b) => severityOrder(b) - severityOrder(a))
    .slice(0, 5);
  return ranked.map((c) => ({
    id: c.id,
    title: c.title,
    reason: c.nextFix ?? c.evidence,
    href: c.affectedRoutes?.[0],
  }));
}

function severityOrder(c: ReadinessCheck): number {
  const severity = { critical: 3, high: 2, medium: 1, low: 0 }[c.severity];
  const statusBonus = c.status === "failing" ? 10 : c.status === "blocked" ? 5 : 0;
  return statusBonus + severity;
}

/** Type-only re-export so consumers can import everything from this module. */
export type { ProductionReadinessReport, ReadinessCheck, CategoryScore } from "./productionReadinessModel";
export { CATEGORY_LABEL };
