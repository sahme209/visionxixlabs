/**
 * secrets_hygiene_engineer — real domain work · Phase 586.
 *
 * Scans the workspace's existing AxiomFinding rows for secret-leak
 * patterns (ruleCode + title keywords + 'secret' in resourceRefs),
 * groups by provider + region, and emits typed candidates the
 * operator should rotate or audit. Pure rules layer handles
 * detection; Claude phrases remediation in the language a security
 * engineer expects.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const SECRETS_HYGIENE_TARGET_KIND = "engineer_secrets_hygiene_candidates";

export type SecretSeverity = "low" | "medium" | "high" | "critical";

export interface SecretCandidate {
  findingId: string;
  severity: SecretSeverity;
  provider: string;
  region: string;
  title: string;
  /** AI-enriched remediation step. Falls back to a rules-based step. */
  recommendedRotation: string;
  ruleCode: string | null;
}

export interface SecretsHygieneReport {
  generatedAt: Date;
  windowDays: number;
  candidatesTotal: number;
  bySeverity: Record<SecretSeverity, number>;
  topCandidates: ReadonlyArray<SecretCandidate>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

const SECRET_KEYWORDS = [
  "secret", "credential", "credentials", "password", "token", "api_key", "apikey", "private_key",
  "access_key", "aws_secret", "iam_secret", "oauth_token", "bearer", "kms",
];

const SEVERITY_RANK: Record<SecretSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function findingLooksSecretLike(f: { title: string; description: string; data: unknown }): { matched: boolean; ruleCode: string | null } {
  const data = f.data as Record<string, unknown> | null;
  const ruleCode = data && typeof data.ruleCode === "string" ? data.ruleCode : null;
  const hay = `${ruleCode ?? ""} ${f.title} ${f.description}`.toLowerCase();
  const matched = SECRET_KEYWORDS.some((kw) => hay.includes(kw));
  return { matched, ruleCode };
}

interface ParsedAiOutput {
  executiveSummary: string;
  rotationByFindingId: Record<string, string>;
}

function buildSystemPrompt(): string {
  return [
    `You are the Secrets Hygiene Scanner on the Axiom platform.`,
    `Your job: take findings that match secret/credential patterns and phrase the next rotation step in the language a security engineer expects.`,
    ``,
    `RULES:`,
    `  · Never invent findings. rotationByFindingId entries must only reference findingIds from the input.`,
    `  · One sentence per finding, ≤ 220 characters, naming the specific rotation action (rotate IAM key, delete leaked SSH key, revoke OAuth token, etc.).`,
    `  · Executive summary: 2-3 sentences naming volume, the most material credential class at risk, and the recommended workspace-wide remediation order.`,
    `  · Plain prose. No markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "rotationByFindingId": { "<findingId>": "<sentence>", "...": "..." }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(candidates: ReadonlyArray<{ finding: SecretCandidate; description: string }>): string {
  const lines: string[] = [];
  lines.push(`Workspace findings matching secret-pattern detection (capped at 10):`);
  if (candidates.length === 0) {
    lines.push(`  (none — provide an executive summary affirming no leaked-secret findings detected and an empty rotationByFindingId)`);
  } else {
    for (const c of candidates) {
      lines.push(``);
      lines.push(`  [${c.finding.findingId}] severity=${c.finding.severity} provider=${c.finding.provider}/${c.finding.region} ruleCode=${c.finding.ruleCode ?? "—"}`);
      lines.push(`    title: ${c.finding.title}`);
      lines.push(`    description: ${c.description.slice(0, 300)}`);
    }
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
    const raw = json.rotationByFindingId;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, rotationByFindingId: {} };
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") map[k] = v.trim().slice(0, 400);
    }
    return { executiveSummary: exec, rotationByFindingId: map };
  } catch {
    return null;
  }
}

function fallbackRotation(c: SecretCandidate): string {
  if (c.severity === "critical") return `Rotate immediately — ${c.title}. The credential is exposed; revoke and re-issue before reviewing.`;
  if (c.severity === "high")     return `Plan rotation for ${c.title} in the next 24 hours. Confirm scope of access before revoking.`;
  return `Investigate ${c.title}; rotate if the credential is still in use, otherwise revoke and delete.`;
}

export async function runSecretsHygieneEngineer(organizationId: string): Promise<SecretsHygieneReport> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Pull recent findings; we filter in-app because the secret detection
  // is keyword-based across multiple text fields and Prisma doesn't
  // give us a clean way to do that in a single query.
  let findings: Array<{
    id: string;
    severity: string;
    provider: string;
    region: string;
    title: string;
    description: string;
    data: unknown;
  }> = [];
  try {
    findings = await prisma.axiomFinding.findMany({
      where: {
        run: { organizationId },
        createdAt: { gte: since30d },
      },
      select: { id: true, severity: true, provider: true, region: true, title: true, description: true, data: true },
      take: 2000,
    });
  } catch {
    findings = [];
  }

  const matches: Array<{ finding: SecretCandidate; description: string }> = [];
  const bySeverity: Record<SecretSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const { matched, ruleCode } = findingLooksSecretLike(f);
    if (!matched) continue;
    const sev = (f.severity as SecretSeverity) ?? "medium";
    const known: SecretSeverity = (["low", "medium", "high", "critical"] as SecretSeverity[]).includes(sev) ? sev : "medium";
    bySeverity[known]++;
    matches.push({
      finding: {
        findingId: f.id,
        severity: known,
        provider: f.provider,
        region: f.region,
        title: f.title,
        recommendedRotation: "",
        ruleCode,
      },
      description: f.description,
    });
  }

  // Severity-then-recency selection of the top 10 to send to Claude.
  matches.sort((a, b) => SEVERITY_RANK[a.finding.severity] - SEVERITY_RANK[b.finding.severity]);
  const candidates = matches.slice(0, 10);

  let executiveSummary = matches.length === 0
    ? "No leaked-secret findings matched the keyword pattern in the last 30 days. Run a fresh secrets scan for confidence."
    : `${matches.length} potential leaked-secret finding${matches.length === 1 ? "" : "s"} in window — ${bySeverity.critical} critical, ${bySeverity.high} high. Rotate in severity order.`;
  let rotationByFindingId: Record<string, string> = {};
  let outcome: SecretsHygieneReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:secrets_hygiene_engineer",
      organizationId,
      timeoutMs: 30_000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(candidates)}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      rotationByFindingId = parsed.rotationByFindingId;
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

  const topCandidates: SecretCandidate[] = candidates.map(({ finding }) => ({
    ...finding,
    recommendedRotation: rotationByFindingId[finding.findingId]?.trim() || fallbackRotation(finding),
  }));

  return {
    generatedAt: new Date(),
    windowDays: 30,
    candidatesTotal: matches.length,
    bySeverity,
    topCandidates,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistSecretsHygieneReport(organizationId: string, report: SecretsHygieneReport): Promise<void> {
  const riskFactors = report.topCandidates.map((c) => `${c.severity} · ${c.provider}/${c.region} · ${c.title}`);
  const payload = report.topCandidates.map((c) => `${c.findingId}|${c.severity}|${c.provider}|${c.region}|${c.recommendedRotation}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: SECRETS_HYGIENE_TARGET_KIND,
          targetId: "secrets_hygiene_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: SECRETS_HYGIENE_TARGET_KIND,
        targetId: "secrets_hygiene_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "secrets-hygiene-engineer-v1",
      },
      update: {
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
      },
    });
  } catch (err) {
    console.warn("[secretsHygieneEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
