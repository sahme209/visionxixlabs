/**
 * compliance_engineer — real domain work · Phase 582.
 *
 * First engineer to graduate from "introduce yourself" to "do your
 * job." This is the blueprint for every subsequent engineer's
 * domain implementation:
 *
 *   1. Load real workspace state (findings, audit events, etc.) via
 *      canonical Prisma reads.
 *   2. Run the engineer's rules-based work — for compliance, walk
 *      every COMPLIANCE_CONTROL and score it against the workspace's
 *      finding rule codes.
 *   3. Ask Claude to enrich the structured output with auditor-
 *      grade narrative (one sentence per control + an overall
 *      executive summary). The pure rules layer is always honest;
 *      the AI layer adds language, not state.
 *   4. Persist the typed report into AiRationaleEnrichment with a
 *      kind unique to this engineer's domain work, so the existing
 *      AGI memory surfaces render it for free.
 *
 * Output stays "best-effort": if Claude fails or the response is
 * unparseable, we fall back to the deterministic rules summary and
 * mark outcome="fallback_rules". Operators always see something
 * honest.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { COMPLIANCE_CONTROLS, scoreControl, type ComplianceControl } from "@/lib/compliance/controls";

export const COMPLIANCE_ENGINEER_TARGET_KIND = "engineer_compliance_report";

export interface ComplianceControlReport {
  controlId: string;
  framework: string;
  title: string;
  status: "passing" | "failing" | "untested";
  matchedCount: number;
  /** AI-enriched plain-language evidence summary. Never invents data —
   *  falls back to the rules-based summary when AI is unavailable. */
  evidenceSummary: string;
}

export interface ComplianceEngineerReport {
  generatedAt: Date;
  ruleCodesObserved: number;
  controlsTotal: number;
  controlsFailing: number;
  controlsUntested: number;
  controls: ReadonlyArray<ComplianceControlReport>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAiOutput {
  executiveSummary: string;
  controlSummaries: Record<string, string>;
}

function ruleSummary(control: ComplianceControl, matchedCount: number, status: ComplianceControlReport["status"]): string {
  if (status === "passing") {
    return `No findings match the rule codes for ${control.id}. Treat as passing pending positive evidence wiring.`;
  }
  if (status === "untested") {
    return `${control.id} has zero matching findings; no positive evidence has been wired so we report it as untested.`;
  }
  return `${matchedCount} workspace finding${matchedCount === 1 ? "" : "s"} match ${control.id} (${control.title}); see the findings page for the underlying rule codes.`;
}

function buildSystemPrompt(): string {
  return [
    `You are the Compliance Engineer on the Axiom cloud-operations platform.`,
    `Your job: phrase machine-scored compliance control evidence in the language a SOC2 / ISO27001 / HIPAA / GDPR auditor expects.`,
    ``,
    `RULES:`,
    `  · Never invent data. Every summary must be supported by the structured input below.`,
    `  · One sentence per control. ≤ 200 characters per summary.`,
    `  · The executive summary is 2-3 sentences naming the overall posture, the most material gap, and the recommended next audit checkpoint.`,
    `  · No headings, no bullet points. Plain prose.`,
    ``,
    `RETURN STRICT JSON only matching:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "controlSummaries": { "<controlId>": "<one sentence>", "...": "..." }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(input: {
  controls: ReadonlyArray<{ control: ComplianceControl; status: ComplianceControlReport["status"]; matchedCount: number; ruleSummary: string }>;
  ruleCodesObserved: number;
}): string {
  const lines: string[] = [];
  lines.push(`Workspace context:`);
  lines.push(`  rule codes observed in recent findings: ${input.ruleCodesObserved}`);
  lines.push(`  total controls: ${input.controls.length}`);
  lines.push(`  failing: ${input.controls.filter((c) => c.status === "failing").length}`);
  lines.push(`  untested: ${input.controls.filter((c) => c.status === "untested").length}`);
  lines.push(``);
  lines.push(`Controls (verbatim — phrase your summaries off these only):`);
  for (const c of input.controls) {
    lines.push(``);
    lines.push(`  [${c.control.id}] framework=${c.control.framework} status=${c.status} matched=${c.matchedCount}`);
    lines.push(`    title: ${c.control.title}`);
    lines.push(`    description: ${c.control.description}`);
    lines.push(`    rule-based finding: ${c.ruleSummary}`);
  }
  return lines.join("\n");
}

function parseAiResponse(text: string): ParsedAiOutput | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const json = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof json.executiveSummary === "string" ? json.executiveSummary.trim().slice(0, 1200) : null;
    if (!exec) return null;
    const ctrlRaw = json.controlSummaries;
    if (!ctrlRaw || typeof ctrlRaw !== "object") return null;
    const summaries: Record<string, string> = {};
    for (const [k, v] of Object.entries(ctrlRaw as Record<string, unknown>)) {
      if (typeof v === "string") summaries[k] = v.slice(0, 600);
    }
    return { executiveSummary: exec, controlSummaries: summaries };
  } catch {
    return null;
  }
}

export async function runComplianceEngineer(organizationId: string): Promise<ComplianceEngineerReport> {
  // Step 1 — pull rule codes from recent findings.
  const ruleCodes: string[] = [];
  try {
    const findings = await prisma.axiomFinding.findMany({
      where: { run: { organizationId } },
      select: { data: true },
      take: 5000,
    });
    for (const f of findings) {
      const data = f.data as Record<string, unknown> | null;
      const code = data && typeof data.ruleCode === "string" ? data.ruleCode : null;
      if (code) ruleCodes.push(code);
    }
  } catch {
    // Migration-pending → empty rule set, every control reads as untested.
  }

  // Step 2 — score every control via the canonical catalog.
  const scored = COMPLIANCE_CONTROLS.map((c) => {
    const { status, matchedCount } = scoreControl(c, ruleCodes);
    return { control: c, status, matchedCount, ruleSummary: ruleSummary(c, matchedCount, status) };
  });

  // Step 3 — ask Claude for auditor-grade narrative.
  let executiveSummary = `Across ${scored.length} compliance controls scored against ${ruleCodes.length} recent finding rule codes: ${scored.filter((s) => s.status === "failing").length} failing, ${scored.filter((s) => s.status === "untested").length} untested. Failing controls warrant priority remediation.`;
  let controlSummaries: Record<string, string> = {};
  let outcome: ComplianceEngineerReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:compliance_engineer",
      organizationId,
      timeoutMs: 30_000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt({ controls: scored, ruleCodesObserved: ruleCodes.length })}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      controlSummaries = parsed.controlSummaries;
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

  const controls: ComplianceControlReport[] = scored.map((s) => ({
    controlId: s.control.id,
    framework: s.control.framework,
    title: s.control.title,
    status: s.status,
    matchedCount: s.matchedCount,
    evidenceSummary: controlSummaries[s.control.id]?.trim() || s.ruleSummary,
  }));

  return {
    generatedAt: new Date(),
    ruleCodesObserved: ruleCodes.length,
    controlsTotal: controls.length,
    controlsFailing: controls.filter((c) => c.status === "failing").length,
    controlsUntested: controls.filter((c) => c.status === "untested").length,
    controls,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistComplianceReport(organizationId: string, report: ComplianceEngineerReport): Promise<void> {
  // The narrative field holds the executive summary; the structured
  // per-control payload lives on nextActionsJson as a JSON blob the
  // surface decodes. riskFactorsJson holds the failing control ids so
  // existing AGI surfaces show 'risk factors' meaningfully.
  const riskFactors = report.controls.filter((c) => c.status === "failing").map((c) => `${c.framework} · ${c.controlId} · ${c.title}`);
  const payload = report.controls.map((c) => `${c.controlId}|${c.status}|${c.matchedCount}|${c.evidenceSummary}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: COMPLIANCE_ENGINEER_TARGET_KIND,
          targetId: "compliance_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: COMPLIANCE_ENGINEER_TARGET_KIND,
        targetId: "compliance_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "compliance-engineer-v1",
      },
      update: {
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "compliance-engineer-v1",
      },
    });
  } catch (err) {
    console.warn("[complianceEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
