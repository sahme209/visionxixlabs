/**
 * release_notes_engineer — real domain work · Phase 592.
 *
 * Operator-input archetype. Operator pastes a commit log / PR list /
 * release notes outline; engineer drafts user-facing + internal +
 * breaking-changes sections + migration notes.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { INJECTION_RESISTANCE_CLAUSE, buildUserInputSection } from "@/lib/workforce/domains/promptHardening";

export const RELEASE_NOTES_TARGET_KIND = "engineer_release_notes_draft";

export interface ReleaseNotesInput {
  title: string;
  commitLog: string;
  releaseTag?: string;
  audience?: string;
}

export interface ReleaseNotesDraft {
  slug: string;
  title: string;
  executiveSummary: string;
  userFacingChanges: ReadonlyArray<string>;
  internalChanges: ReadonlyArray<string>;
  breakingChanges: ReadonlyArray<string>;
  migrationNotes: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  userFacingChanges: string[];
  internalChanges: string[];
  breakingChanges: string[];
  migrationNotes: string;
}

const MAX_TITLE = 200;
const MAX_BODY = 8000;

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function buildSystemPrompt(): string {
  return [
    `You are the Release Notes Engineer on the Axiom platform.`,
    `Your job: take a raw commit log / PR list and draft polished release notes a customer would expect from a SaaS changelog.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `RULES:`,
    `  · Never invent changes that aren't visible in the input.`,
    `  · Executive summary: 2-3 sentences naming the headline change, the version's theme, and the most material customer-visible improvement.`,
    `  · userFacingChanges: 3-8 entries, each one a single line in customer-friendly language (no commit shas, no internal codenames).`,
    `  · internalChanges: 2-6 entries naming changes worth flagging to the engineering team but not customers.`,
    `  · breakingChanges: 0-4 entries. EMPTY when there are no breaking changes — never invent them.`,
    `  · migrationNotes: 1-3 sentences if there ARE breaking changes; empty string if none.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{ "executiveSummary": "...", "userFacingChanges": [...], "internalChanges": [...], "breakingChanges": [...], "migrationNotes": "..." }`,
  ].join("\n");
}

function buildUserPrompt(i: ReleaseNotesInput): string {
  return buildUserInputSection([
    { label: "title", content: i.title },
    { label: "release_tag", content: i.releaseTag ?? "" },
    { label: "target_audience", content: i.audience ?? "" },
    { label: "commit_log_or_pr_list", content: i.commitLog },
  ]);
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{"); const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const migration = typeof j.migrationNotes === "string" ? j.migrationNotes.trim().slice(0, 800) : "";
    const strs = (v: unknown, max: number) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim().slice(0, 400)).filter((s) => s.length > 0).slice(0, max) : [];
    return {
      executiveSummary: exec,
      userFacingChanges: strs(j.userFacingChanges, 8),
      internalChanges: strs(j.internalChanges, 6),
      breakingChanges: strs(j.breakingChanges, 4),
      migrationNotes: migration,
    };
  } catch { return null; }
}

export async function runReleaseNotesEngineer(organizationId: string, raw: ReleaseNotesInput): Promise<ReleaseNotesDraft> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const commitLog = raw.commitLog.trim().slice(0, MAX_BODY);
  if (!title || !commitLog) {
    return {
      slug: "", title,
      executiveSummary: "Input incomplete. Title + commit log are required.",
      userFacingChanges: [], internalChanges: [], breakingChanges: [],
      migrationNotes: "",
      outcome: "error", modelHint: null, errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `release_${Date.now().toString(36)}`;
  const input: ReleaseNotesInput = {
    title, commitLog,
    releaseTag: raw.releaseTag?.trim().slice(0, 80),
    audience: raw.audience?.trim().slice(0, 400),
  };

  let outcome: ReleaseNotesDraft["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:release_notes_engineer",
      organizationId,
      timeoutMs: 45_000,
    });
    const result = await fetcher(`${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(input)}`);
    parsed = parseAi(result.text);
    if (parsed) { outcome = "ai_generated"; modelHint = result.modelHint; }
    else        { errorMessage = "ai_response_unparseable"; }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    errorMessage = msg;
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
  }

  return {
    slug, title,
    executiveSummary: parsed?.executiveSummary ?? `Stub release notes for "${title}". Re-run when the AI provider is healthy.`,
    userFacingChanges: parsed?.userFacingChanges ?? [],
    internalChanges: parsed?.internalChanges ?? [],
    breakingChanges: parsed?.breakingChanges ?? [],
    migrationNotes: parsed?.migrationNotes ?? "",
    outcome, modelHint, errorMessage,
  };
}

export async function persistReleaseNotesDraft(organizationId: string, d: ReleaseNotesDraft): Promise<void> {
  if (!d.slug) return;
  const payload: string[] = [`title|${d.title}`];
  if (d.migrationNotes) payload.push(`migration|${d.migrationNotes}`);
  for (const u of d.userFacingChanges) payload.push(`user_facing|${u}`);
  for (const i of d.internalChanges)   payload.push(`internal|${i}`);
  for (const b of d.breakingChanges)   payload.push(`breaking|${b}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: { organizationId_targetKind_targetId: { organizationId, targetKind: RELEASE_NOTES_TARGET_KIND, targetId: d.slug } },
      create: {
        organizationId, targetKind: RELEASE_NOTES_TARGET_KIND, targetId: d.slug,
        narrative: d.executiveSummary,
        riskFactorsJson: d.breakingChanges as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: d.outcome, errorMessage: d.errorMessage, modelHint: d.modelHint,
        engineVersion: "release-notes-engineer-v1",
      },
      update: {
        narrative: d.executiveSummary,
        riskFactorsJson: d.breakingChanges as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: d.outcome, errorMessage: d.errorMessage, modelHint: d.modelHint,
      },
    });
  } catch (err) {
    console.warn("[releaseNotesEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
