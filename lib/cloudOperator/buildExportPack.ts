/**
 * Export pack builder — core logic reusable by API route and agent tools.
 */

import { prisma } from "@/lib/db";
import {
  canViewTechnicalOutputs,
  hasContinuousReassessment,
  hasEnterpriseEngagement,
  resolveOperatorTier,
} from "@/lib/cloudOperator/pricing";
import type { OperatorTier } from "@/lib/cloudOperator/types";
import Archiver from "archiver";
import { PassThrough } from "stream";

export type BuildExportPackResult =
  | { success: true; buffer: Buffer }
  | { success: false; error: string };

/**
 * Build Axiom export pack ZIP for a lead.
 */
export async function buildExportPack(leadId: string): Promise<BuildExportPackResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.source !== "cloud-operator") {
    return { success: false, error: "Lead not found or invalid source" };
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const tier = resolveOperatorTier(payload.tier as string) as OperatorTier;
  const outputStatus = payload.outputStatus as string;
  if (outputStatus !== "ready") {
    return { success: false, error: "Analysis not ready. Run the operator first." };
  }

  const operatorOutput = payload.operatorOutput as Record<string, unknown> | null | undefined;
  const axiomResult = payload.axiomResult as {
    scores?: Record<string, unknown>;
    plan?: Record<string, unknown>;
    driftSignals?: { signals?: string[]; recommendedNextActions?: string[] };
    playbooks?: Record<string, unknown>;
    quality?: { pass?: boolean; issues?: string[] };
  } | null | undefined;
  const axiomScores = (axiomResult?.scores ?? payload.axiomScores) as Record<string, unknown> | null | undefined;
  const axiomPlan = (axiomResult?.plan ?? payload.axiomPlan) as Record<string, unknown> | null | undefined;

  const canPro = canViewTechnicalOutputs(tier);
  const canGrowth = hasContinuousReassessment(tier);
  const canEnterprise = hasEnterpriseEngagement(tier);

  const executiveSummary = [
    "# Axiom — Executive Summary",
    "",
    `**Infrastructure Score:** ${axiomScores?.infrastructureScore ?? "—"}`,
    `**Estimated Annual Savings:** ${axiomScores?.estimatedAnnualSavings != null ? `$${axiomScores.estimatedAnnualSavings}` : "—"}`,
    `**Risk Level:** ${axiomScores?.riskExposureLevel ?? "—"}`,
    `**Deployment Friction Index:** ${axiomScores?.deploymentFrictionIndex ?? "—"}`,
    `**Complexity Tier:** ${axiomScores?.complexityTier ?? "—"}`,
    "",
    (operatorOutput?.business as { businessImpactSummary?: string } | undefined)?.businessImpactSummary ?? "",
  ].join("\n");

  const chunks: Buffer[] = [];
  const archive = Archiver("zip", { zlib: { level: 9 } });
  const collector = new PassThrough();
  collector.on("data", (chunk: Buffer) => chunks.push(chunk));
  archive.pipe(collector);

  archive.append(executiveSummary, { name: "executive-summary.md" });

  if (canPro && axiomPlan) {
    archive.append(
      ["# 30-Day Infrastructure Optimization Plan", "", JSON.stringify(axiomPlan, null, 2)].join("\n"),
      { name: "30-day-plan.md" }
    );
  }

  const axiomPlaybooks = axiomResult?.playbooks as {
    phasePlaybooks?: Array<{
      phaseName: string;
      objective: string;
      prerequisites: string[];
      stepByStep: Array<{ step: string; command?: string }>;
      rollbackPlan: string[];
      successCriteria: string[];
    }>;
    cutoverChecklist?: string[];
    ownerRoles?: string[];
    estimatedEffortHours?: number;
  } | undefined;
  if (canGrowth && axiomPlaybooks) {
    const lines: string[] = [
      "# Axiom Playbooks",
      "",
      `**Estimated effort:** ${axiomPlaybooks.estimatedEffortHours ?? "—"} hours`,
      `**Owner roles:** ${(axiomPlaybooks.ownerRoles ?? []).join(", ")}`,
      "",
      "## Cutover Checklist",
      "",
      ...(axiomPlaybooks.cutoverChecklist ?? []).map((c) => `- [ ] ${c}`),
      "",
    ];
    for (const pp of axiomPlaybooks.phasePlaybooks ?? []) {
      lines.push(`## ${pp.phaseName}`, "", pp.objective, "", "### Prerequisites", "", ...pp.prerequisites.map((p) => `- ${p}`), "", "### Steps", "");
      for (let i = 0; i < pp.stepByStep.length; i++) {
        const s = pp.stepByStep[i];
        lines.push(`${i + 1}. ${s.step}`);
        if (s.command) lines.push(`   \`${s.command}\``);
      }
      lines.push("", "### Rollback", "", ...pp.rollbackPlan.map((r) => `- ${r}`), "", "### Success criteria", "", ...pp.successCriteria.map((c) => `- ${c}`), "");
    }
    archive.append(lines.join("\n"), { name: "playbooks.md" });
  }

  if (canPro && operatorOutput?.launch) {
    const launch = operatorOutput.launch as Record<string, unknown>;
    if (launch.ciCdYaml) archive.append(String(launch.ciCdYaml), { name: "ci-cd.yml" });
    if (launch.dockerfile) archive.append(String(launch.dockerfile), { name: "Dockerfile" });
    if (Array.isArray(launch.terraformTemplates) && launch.terraformTemplates.length > 0) {
      archive.append((launch.terraformTemplates as string[]).join("\n\n"), { name: "terraform.tf" });
    }
  }

  const secure = operatorOutput?.secure as { hardeningChecklist?: string[] } | undefined;
  const checklist =
    secure?.hardeningChecklist?.map((c) => `- [ ] ${c}`).join("\n") ??
    "- [ ] Review IAM policies\n- [ ] Enable MFA\n- [ ] Audit public exposure\n";
  archive.append(["# Security Checklist", "", checklist].join("\n"), { name: "security-checklist.md" });

  const axiomQuality = axiomResult?.quality;
  if (canPro && axiomQuality) {
    const qLines = [
      "# Quality Gate",
      "",
      `**Pass:** ${axiomQuality.pass ? "Yes" : "No (needs review)"}`,
      "",
      ...(axiomQuality.issues ?? []).map((i) => `- ${i}`),
    ].filter(Boolean);
    archive.append(qLines.join("\n"), { name: "quality-gate.md" });
  }

  if (canGrowth && axiomResult?.driftSignals) {
    const drift = axiomResult.driftSignals;
    archive.append(
      [
        "# Drift Report",
        "",
        "## Signals",
        ...(drift.signals ?? []).map((s) => `- ${s}`),
        "",
        "## Recommended Actions",
        ...(drift.recommendedNextActions ?? []).map((a) => `- ${a}`),
      ].join("\n"),
      { name: "drift-report.md" }
    );
  }

  if (canGrowth) {
    const snapshots = await prisma.axiomScoreSnapshot.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    const csvHeader =
      "createdAt,tier,provider,infrastructureScore,estimatedAnnualSavings,riskExposureLevel,deploymentFrictionIndex,complexityTier,automationReadinessScore";
    const csvRows = snapshots.map((s) =>
      [
        s.createdAt.toISOString(),
        s.tier,
        s.provider ?? "",
        s.infrastructureScore ?? "",
        s.estimatedAnnualSavings ?? "",
        s.riskExposureLevel ?? "",
        s.deploymentFrictionIndex ?? "",
        s.complexityTier ?? "",
        s.automationReadinessScore ?? "",
      ].join(",")
    );
    archive.append([csvHeader, ...csvRows].join("\n"), { name: "trend-history.csv" });
  }

  if (canEnterprise) {
    archive.append("# Advisory Notes\n\n_Add strategic review notes here._\n\n## Key Decisions\n\n## Follow-ups\n\n", {
      name: "advisory-notes.md",
    });
  }

  await new Promise<void>((resolve, reject) => {
    collector.on("finish", resolve);
    archive.on("error", reject);
    archive.finalize();
  });

  const buffer = Buffer.concat(chunks);
  return { success: true, buffer };
}
