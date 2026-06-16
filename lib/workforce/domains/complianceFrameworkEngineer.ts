/**
 * compliance_framework_engineer — real domain work · Phase 636.
 *
 * Operator-input archetype. Extends compliance_engineer (Phase 582)
 * from "SOC2/ISO27001 narrative" to "score against any one of 6
 * frameworks with verbatim control citations." The compliance
 * engineer walks workspace state; this engineer is for the
 * point-in-time enterprise assessment a customer's auditor would
 * ask for.
 *
 * Frameworks supported (operator picks one per assessment):
 *   · SOC2 (Trust Service Criteria)
 *   · ISO27001 (Annex A controls)
 *   · HIPAA (Security Rule technical/admin/physical safeguards)
 *   · PCI-DSS v4
 *   · NIST 800-53
 *   · CIS Benchmarks (cloud account hardening)
 *
 * Output:
 *   · overallScore (0-100)
 *   · controlAssessments — typed status + evidence + gap + remediation
 *     per control the operator scoped in
 *   · prioritizedGaps — top 5 ordered by risk × ease
 *   · executiveSummary — auditor-grade narrative
 *
 * Each control assessment cites the framework's actual control id
 * (e.g. "CC6.1" for SOC2, "A.8.5" for ISO27001) so the output is
 * directly mappable to the customer's audit packet.
 *
 * Routes through the canonical instrumented fetcher — Phase 581
 * cost passthrough and Phase 628 credit gate apply.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import {
  INJECTION_RESISTANCE_CLAUSE,
  buildUserInputSection,
} from "@/lib/workforce/domains/promptHardening";

export const COMPLIANCE_FRAMEWORK_TARGET_KIND = "engineer_compliance_framework_assessment";

export type ComplianceFramework =
  | "soc2"
  | "iso27001"
  | "hipaa"
  | "pci_dss"
  | "nist_800_53"
  | "cis_benchmark";

export type ControlStatus = "pass" | "partial" | "fail" | "na";

export interface ComplianceFrameworkInput {
  title: string;
  framework: ComplianceFramework;
  cloudPosture: string;
  /** Optional comma-separated list of control IDs to focus on.
   *  Empty = engineer picks the most material controls for the
   *  framework. */
  inScopeControls?: string;
  /** Optional auditor / stakeholder context (e.g. "for our SOC2
   *  Type II audit kickoff with Coalfire in August"). */
  auditContext?: string;
}

export interface ControlAssessment {
  controlId: string;
  controlTitle: string;
  status: ControlStatus;
  evidence: string;
  gap: string;
  remediation: string;
}

export interface ComplianceFrameworkAssessment {
  slug: string;
  title: string;
  framework: ComplianceFramework;
  executiveSummary: string;
  overallScore: number;
  controlAssessments: ReadonlyArray<ControlAssessment>;
  prioritizedGaps: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  overallScore: number;
  controlAssessments: ControlAssessment[];
  prioritizedGaps: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 8000;

const FRAMEWORK_LABEL: Record<ComplianceFramework, string> = {
  soc2: "SOC2 (Trust Service Criteria)",
  iso27001: "ISO/IEC 27001:2022 (Annex A)",
  hipaa: "HIPAA Security Rule",
  pci_dss: "PCI-DSS v4",
  nist_800_53: "NIST SP 800-53 Rev. 5",
  cis_benchmark: "CIS Benchmark (cloud account hardening)",
};

const FRAMEWORK_CONTROL_GUIDANCE: Record<ComplianceFramework, string> = {
  soc2: `Cite Trust Service Criteria control IDs verbatim (e.g. "CC6.1", "CC7.2", "A1.1", "PI1.1"). Group by Security (CC), Availability (A), Confidentiality (C), Processing Integrity (PI), Privacy (P) as applicable.`,
  iso27001: `Cite Annex A control IDs verbatim (e.g. "A.5.1", "A.8.5", "A.8.24"). Use the 2022 revision numbering (93 controls in 4 themes: Organizational, People, Physical, Technological).`,
  hipaa: `Cite the Security Rule subsection verbatim (e.g. "§164.308(a)(1)" administrative, "§164.310" physical, "§164.312(a)(1)" technical). Always distinguish required (R) vs addressable (A) implementation specifications.`,
  pci_dss: `Cite PCI-DSS v4 requirement IDs verbatim (e.g. "1.2.5", "3.4.1", "8.3.6"). Reference the 12 high-level requirements and call out which apply to the cardholder data environment (CDE).`,
  nist_800_53: `Cite control IDs verbatim with the family prefix (e.g. "AC-2", "AU-6", "SC-13", "SI-4"). Reference Rev. 5 control families: AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PM, PS, PT, RA, SA, SC, SI, SR.`,
  cis_benchmark: `Cite CIS Benchmark recommendation numbers (e.g. "1.4", "2.1.1", "5.2") and name the cloud provider context (CIS AWS Foundations / CIS Azure / CIS GCP) inline.`,
};

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function clampScore(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function buildSystemPrompt(framework: ComplianceFramework): string {
  return [
    `You are the Compliance Framework Engineer on the Axiom platform.`,
    `Your job: take a customer's described cloud posture and produce a point-in-time assessment against the ${FRAMEWORK_LABEL[framework]} framework — the kind a third-party auditor would expect at SOC2 Type II kickoff or PCI-DSS Report on Compliance scoping.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `FRAMEWORK CONTROL CITATION RULES:`,
    `  · ${FRAMEWORK_CONTROL_GUIDANCE[framework]}`,
    ``,
    `STATUS PER CONTROL:`,
    `  · pass     — evidence exists, control is operating effectively`,
    `  · partial  — evidence is incomplete or control is partially operating`,
    `  · fail     — no evidence or control is not operating`,
    `  · na       — control does not apply to this scope`,
    ``,
    `RULES:`,
    `  · Honest scope. If the cloud posture is too thin to assess a control, mark status=partial with the gap "insufficient evidence supplied — request {specific artifact}".`,
    `  · Executive summary: 3-4 sentences naming the headline posture, the framework, the overallScore, and the riskiest gap.`,
    `  · controlAssessments: 6-14 entries. Each entry MUST cite the exact control id verbatim from the framework numbering.`,
    `    - evidence: 1-2 sentences ≤ 320 chars naming what the customer has that supports this control.`,
    `    - gap: 1-2 sentences ≤ 320 chars naming what's missing (empty string when status=pass).`,
    `    - remediation: 1 sentence ≤ 280 chars naming the concrete first step (empty string when status=pass or status=na).`,
    `  · overallScore: integer 0-100. Compute weighted (pass=1.0, partial=0.5, fail=0, na excluded) rounded to integer.`,
    `  · prioritizedGaps: 3-5 entries naming the highest-leverage gaps (risk × ease-to-fix). Each entry ≤ 200 chars.`,
    `  · Never invent controls — only cite real framework control IDs.`,
    `  · Never invent posture evidence — only reason about what the operator described.`,
    `  · Plain prose. No markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<3-4 sentences>",`,
    `  "overallScore": <0-100 integer>,`,
    `  "controlAssessments": [`,
    `    { "controlId": "...", "controlTitle": "...", "status": "<pass|partial|fail|na>", "evidence": "...", "gap": "...", "remediation": "..." }`,
    `  ],`,
    `  "prioritizedGaps": ["...", "..."]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: ComplianceFrameworkInput): string {
  return buildUserInputSection([
    { label: "title", content: i.title },
    { label: "target_framework", content: FRAMEWORK_LABEL[i.framework] },
    { label: "audit_context", content: i.auditContext ?? "" },
    { label: "in_scope_controls", content: i.inScopeControls ?? "" },
    { label: "cloud_posture_description", content: i.cloudPosture },
  ]);
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const overallScore = clampScore(j.overallScore);
    const rawControls = Array.isArray(j.controlAssessments) ? (j.controlAssessments as unknown[]) : [];
    const controlAssessments: ControlAssessment[] = [];
    for (let i = 0; i < rawControls.length && controlAssessments.length < 14; i += 1) {
      const item = rawControls[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const controlId = typeof obj.controlId === "string" ? obj.controlId.trim().slice(0, 40) : "";
      const controlTitle = typeof obj.controlTitle === "string" ? obj.controlTitle.trim().slice(0, 240) : "";
      const statusRaw = obj.status;
      const status: ControlStatus =
        statusRaw === "pass" || statusRaw === "partial" || statusRaw === "fail" || statusRaw === "na"
          ? statusRaw
          : "partial";
      const evidence = typeof obj.evidence === "string" ? obj.evidence.trim().slice(0, 480) : "";
      const gap = typeof obj.gap === "string" ? obj.gap.trim().slice(0, 480) : "";
      const remediation = typeof obj.remediation === "string" ? obj.remediation.trim().slice(0, 400) : "";
      if (controlId && controlTitle) {
        controlAssessments.push({ controlId, controlTitle, status, evidence, gap, remediation });
      }
    }
    const prioritizedGaps = Array.isArray(j.prioritizedGaps)
      ? (j.prioritizedGaps as unknown[])
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim().slice(0, 280))
          .filter((s) => s.length > 0)
          .slice(0, 5)
      : [];
    return { executiveSummary: exec, overallScore, controlAssessments, prioritizedGaps };
  } catch {
    return null;
  }
}

export async function runComplianceFrameworkEngineer(
  organizationId: string,
  raw: ComplianceFrameworkInput,
): Promise<ComplianceFrameworkAssessment> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const cloudPosture = raw.cloudPosture.trim().slice(0, MAX_BODY);
  if (!title || !cloudPosture) {
    return {
      slug: "",
      title,
      framework: raw.framework,
      executiveSummary: "Input incomplete. Title + cloud posture description are required.",
      overallScore: 0,
      controlAssessments: [],
      prioritizedGaps: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = `${raw.framework}_${slugify(title) || Date.now().toString(36)}`;
  const input: ComplianceFrameworkInput = {
    title,
    framework: raw.framework,
    cloudPosture,
    inScopeControls: raw.inScopeControls?.trim().slice(0, 1000),
    auditContext: raw.auditContext?.trim().slice(0, 800),
  };

  let outcome: ComplianceFrameworkAssessment["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: `engineer_domain:compliance_framework_engineer:${raw.framework}`,
      organizationId,
      timeoutMs: 60_000,
      maxTokens: 4000,
    });
    const result = await fetcher(`${buildSystemPrompt(raw.framework)}\n\n---\n\n${buildUserPrompt(input)}`);
    parsed = parseAi(result.text);
    if (parsed) {
      outcome = "ai_generated";
      modelHint = result.modelHint;
    } else {
      errorMessage = "ai_response_unparseable";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    errorMessage = msg;
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
  }

  return {
    slug,
    title,
    framework: raw.framework,
    executiveSummary:
      parsed?.executiveSummary ??
      `Stub assessment for "${title}" against ${FRAMEWORK_LABEL[raw.framework]}. Re-run when the AI provider is healthy.`,
    overallScore: parsed?.overallScore ?? 0,
    controlAssessments: parsed?.controlAssessments ?? [],
    prioritizedGaps: parsed?.prioritizedGaps ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistComplianceFrameworkAssessment(
  organizationId: string,
  a: ComplianceFrameworkAssessment,
): Promise<void> {
  if (!a.slug) return;
  const payload: string[] = [
    `title|${a.title}`,
    `framework|${a.framework}`,
    `framework_label|${FRAMEWORK_LABEL[a.framework]}`,
    `overall_score|${a.overallScore}`,
  ];
  for (const c of a.controlAssessments) {
    payload.push(`control|${c.controlId}|${c.status}|${c.controlTitle}`);
    if (c.evidence) payload.push(`evidence|${c.controlId}|${c.evidence}`);
    if (c.gap) payload.push(`gap|${c.controlId}|${c.gap}`);
    if (c.remediation) payload.push(`remediation|${c.controlId}|${c.remediation}`);
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: COMPLIANCE_FRAMEWORK_TARGET_KIND,
          targetId: a.slug,
        },
      },
      create: {
        organizationId,
        targetKind: COMPLIANCE_FRAMEWORK_TARGET_KIND,
        targetId: a.slug,
        narrative: a.executiveSummary,
        riskFactorsJson: a.prioritizedGaps as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: a.outcome,
        errorMessage: a.errorMessage,
        modelHint: a.modelHint,
        engineVersion: "compliance-framework-engineer-v1",
      },
      update: {
        narrative: a.executiveSummary,
        riskFactorsJson: a.prioritizedGaps as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: a.outcome,
        errorMessage: a.errorMessage,
        modelHint: a.modelHint,
      },
    });
  } catch (err) {
    console.warn("[complianceFrameworkEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
