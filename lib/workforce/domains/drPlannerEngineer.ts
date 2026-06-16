/**
 * dr_planner_engineer — real domain work · Phase 638.
 *
 * Operator-input archetype. Customer pastes infrastructure topology
 * + RPO/RTO targets + criticality tiers; engineer drafts a
 * disaster-recovery plan with backup verification steps, tested
 * failover runbook, and chaos-drill protocol.
 *
 * Built specifically for the LinkedIn enterprise lead asking for
 * "Disaster recovery and contingency plans" as part of their
 * 2-month engagement. Standard deliverable in any SOC2 Type II /
 * ISO27001 / NIST CP-2 audit.
 *
 * OUTPUT MAPS TO NIST SP 800-34 + ISO 22301:
 *   · businessImpactAnalysis    — what dies if X dies, when
 *   · backupStrategy            — what to back up + how often + where + verification
 *   · failoverRunbook           — ordered steps to restore service
 *   · chaosDrillProtocol        — quarterly drill plan with measurable outcomes
 *   · rolesAndResponsibilities  — who does what during incident + recovery
 *   · communicationPlan         — internal + external comms cadence
 *
 * Routes through canonical instrumented fetcher with prompt-injection
 * hardening + credit gate + cost passthrough.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import {
  INJECTION_RESISTANCE_CLAUSE,
  buildUserInputSection,
} from "@/lib/workforce/domains/promptHardening";

export const DR_PLANNER_TARGET_KIND = "engineer_dr_plan";

export interface DrPlannerInput {
  title: string;
  /** Free-form infrastructure topology description. */
  topology: string;
  /** RPO target with units (e.g. "15 minutes", "1 hour", "24 hours"). */
  rpoTarget: string;
  /** RTO target with units. */
  rtoTarget: string;
  /** Top tier-0 services (the ones that take the company offline). */
  tier0Services?: string;
  /** Existing backup tools / processes the customer already has. */
  existingBackups?: string;
  /** Compliance frameworks driving the DR requirement. */
  complianceContext?: string;
}

export interface DrPlanSection {
  title: string;
  /** Body in plain prose, 2-4 sentences max per bullet. */
  bullets: ReadonlyArray<string>;
}

export interface DrPlan {
  slug: string;
  title: string;
  executiveSummary: string;
  declaredRpo: string;
  declaredRto: string;
  /** Engineer's read on whether the declared RPO/RTO is achievable
   *  given the topology described. */
  achievabilityVerdict: "achievable" | "aspirational" | "gap";
  achievabilityRationale: string;
  /** The 6 NIST 800-34 sections. */
  sections: ReadonlyArray<DrPlanSection>;
  /** Top 3-5 risks that could break the plan. */
  topRisks: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  achievabilityVerdict: DrPlan["achievabilityVerdict"];
  achievabilityRationale: string;
  sections: Array<{ title: string; bullets: string[] }>;
  topRisks: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 8000;

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function buildSystemPrompt(): string {
  return [
    `You are the DR Planner Engineer on the Axiom platform.`,
    `Your job: take a customer's described infrastructure + their RPO/RTO targets and produce a disaster-recovery plan an auditor would accept as SOC2 CC7.5 / NIST 800-34 / ISO 22301 evidence.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `OUTPUT STRUCTURE — Six required sections, in this order:`,
    `  1. Business Impact Analysis — what dies if X dies, what's the downstream blast`,
    `  2. Backup Strategy — what to back up, how often, where, how verified`,
    `  3. Failover Runbook — ordered steps to restore service to the RTO target`,
    `  4. Chaos Drill Protocol — quarterly drill plan with measurable outcomes`,
    `  5. Roles and Responsibilities — who does what during incident + recovery (incident commander, comms lead, infra lead, etc.)`,
    `  6. Communication Plan — internal + external comms cadence + templates`,
    ``,
    `RULES:`,
    `  · Honest scope. If the customer's stated RPO/RTO is unrealistic given their topology, set achievabilityVerdict="aspirational" or "gap" and explain in achievabilityRationale.`,
    `    - achievable: RPO/RTO are realistic with the proposed plan + current topology.`,
    `    - aspirational: stretches but doable with the proposed investments.`,
    `    - gap: not achievable as-is, requires major infrastructure changes (call them out).`,
    `  · Executive summary: 3-4 sentences naming the headline plan, the achievability verdict, and the top risk.`,
    `  · Each section: 3-6 bullets. Each bullet is 1-3 sentences ≤ 400 chars. Use plain prose, no markdown.`,
    `  · BackupStrategy bullets MUST name: data type, backup frequency, retention, storage location, verification method.`,
    `  · FailoverRunbook bullets MUST be ORDERED ACTIONS (e.g. "1. Confirm primary DB is down via N=3 health-check sources"). Each runbook step names the expected time-to-complete to keep the runbook honest about hitting RTO.`,
    `  · ChaosDrillProtocol bullets MUST name: drill cadence, drill scenario, measurable success criteria.`,
    `  · Never invent infrastructure components that aren't in the topology block.`,
    `  · Top risks: 3-5 entries each ≤ 280 chars naming what could break the plan and the early-warning signal for that risk.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "achievabilityVerdict": "<achievable|aspirational|gap>",`,
    `  "achievabilityRationale": "<1-3 sentences>",`,
    `  "sections": [`,
    `    { "title": "Business Impact Analysis", "bullets": ["...", "..."] },`,
    `    { "title": "Backup Strategy", "bullets": ["...", "..."] },`,
    `    { "title": "Failover Runbook", "bullets": ["1. ...", "2. ..."] },`,
    `    { "title": "Chaos Drill Protocol", "bullets": ["...", "..."] },`,
    `    { "title": "Roles and Responsibilities", "bullets": ["...", "..."] },`,
    `    { "title": "Communication Plan", "bullets": ["...", "..."] }`,
    `  ],`,
    `  "topRisks": ["...", "..."]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: DrPlannerInput): string {
  return buildUserInputSection([
    { label: "title", content: i.title },
    { label: "rpo_target", content: i.rpoTarget },
    { label: "rto_target", content: i.rtoTarget },
    { label: "tier_0_services", content: i.tier0Services ?? "" },
    { label: "existing_backups", content: i.existingBackups ?? "" },
    { label: "compliance_context", content: i.complianceContext ?? "" },
    { label: "infrastructure_topology", content: i.topology },
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
    const verdictRaw = j.achievabilityVerdict;
    const achievabilityVerdict: DrPlan["achievabilityVerdict"] =
      verdictRaw === "achievable" || verdictRaw === "aspirational" || verdictRaw === "gap"
        ? verdictRaw
        : "aspirational";
    const achievabilityRationale = typeof j.achievabilityRationale === "string" ? j.achievabilityRationale.trim().slice(0, 600) : "";
    const rawSections = Array.isArray(j.sections) ? (j.sections as unknown[]) : [];
    const sections: ParsedAi["sections"] = [];
    for (const item of rawSections) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const sectionTitle = typeof obj.title === "string" ? obj.title.trim().slice(0, 80) : "";
      const bulletsRaw = Array.isArray(obj.bullets) ? (obj.bullets as unknown[]) : [];
      const bullets = bulletsRaw
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().slice(0, 500))
        .filter((s) => s.length > 0)
        .slice(0, 8);
      if (sectionTitle && bullets.length > 0) {
        sections.push({ title: sectionTitle, bullets });
      }
    }
    const topRisks = Array.isArray(j.topRisks)
      ? (j.topRisks as unknown[])
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim().slice(0, 320))
          .filter((s) => s.length > 0)
          .slice(0, 5)
      : [];
    return { executiveSummary: exec, achievabilityVerdict, achievabilityRationale, sections, topRisks };
  } catch {
    return null;
  }
}

export async function runDrPlannerEngineer(
  organizationId: string,
  raw: DrPlannerInput,
): Promise<DrPlan> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const topology = raw.topology.trim().slice(0, MAX_BODY);
  const rpoTarget = raw.rpoTarget.trim().slice(0, 80);
  const rtoTarget = raw.rtoTarget.trim().slice(0, 80);
  if (!title || !topology || !rpoTarget || !rtoTarget) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + topology + RPO + RTO are required.",
      declaredRpo: rpoTarget,
      declaredRto: rtoTarget,
      achievabilityVerdict: "aspirational",
      achievabilityRationale: "",
      sections: [],
      topRisks: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `dr_${Date.now().toString(36)}`;
  const input: DrPlannerInput = {
    title,
    topology,
    rpoTarget,
    rtoTarget,
    tier0Services: raw.tier0Services?.trim().slice(0, 1000),
    existingBackups: raw.existingBackups?.trim().slice(0, 1000),
    complianceContext: raw.complianceContext?.trim().slice(0, 600),
  };

  let outcome: DrPlan["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:dr_planner_engineer",
      organizationId,
      timeoutMs: 75_000,
      maxTokens: 4500,
    });
    const result = await fetcher(`${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(input)}`);
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
    executiveSummary:
      parsed?.executiveSummary ??
      `Stub DR plan for "${title}". Re-run when the AI provider is healthy.`,
    declaredRpo: rpoTarget,
    declaredRto: rtoTarget,
    achievabilityVerdict: parsed?.achievabilityVerdict ?? "aspirational",
    achievabilityRationale: parsed?.achievabilityRationale ?? "",
    sections: parsed?.sections ?? [],
    topRisks: parsed?.topRisks ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistDrPlan(
  organizationId: string,
  p: DrPlan,
): Promise<void> {
  if (!p.slug) return;
  const payload: string[] = [
    `title|${p.title}`,
    `rpo_target|${p.declaredRpo}`,
    `rto_target|${p.declaredRto}`,
    `achievability_verdict|${p.achievabilityVerdict}`,
    `achievability_rationale|${p.achievabilityRationale}`,
  ];
  for (const section of p.sections) {
    payload.push(`section|${section.title}`);
    for (const bullet of section.bullets) {
      payload.push(`bullet|${section.title}|${bullet}`);
    }
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: DR_PLANNER_TARGET_KIND,
          targetId: p.slug,
        },
      },
      create: {
        organizationId,
        targetKind: DR_PLANNER_TARGET_KIND,
        targetId: p.slug,
        narrative: p.executiveSummary,
        riskFactorsJson: p.topRisks as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome,
        errorMessage: p.errorMessage,
        modelHint: p.modelHint,
        engineVersion: "dr-planner-engineer-v1",
      },
      update: {
        narrative: p.executiveSummary,
        riskFactorsJson: p.topRisks as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome,
        errorMessage: p.errorMessage,
        modelHint: p.modelHint,
      },
    });
  } catch (err) {
    console.warn("[drPlannerEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}

