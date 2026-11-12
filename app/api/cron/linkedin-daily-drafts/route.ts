/**
 * GET/POST /api/cron/linkedin-daily-drafts
 * Existing authenticated authoring pipeline: generate drafts, score them and
 * recommend a candidate for human review. No image generation/upload, posting
 * credential access, invented approval or automatic publication schedule.
 * A recommendation never supplies platform execution/service authority.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { planContent } from "@/lib/growth/contentPlanner";
import { createDraft } from "@/lib/growth/draftStore";
import { writeGrowthAudit } from "@/lib/growth/audit";
import { checkHallucination } from "@/lib/growth/hallucinationCheck";
import { decideAutopilotAction, loadAutopilotPolicy } from "@/lib/growth/autopilot";
import type { ContentTopicCategory } from "@/lib/growth/growthModels";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Existing content-planning budget; no image/provider write in this route.

const ROTATION: ContentTopicCategory[] = [
  "product_education",
  "thought_leadership",
  "technical_deep_dive",
  "case_study",
  "founder_voice",
  "launch_announcement",
];

export async function GET(req: NextRequest)  { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_not_configured" }, { status: 503 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  const policy = loadAutopilotPolicy();
  const dayIndex = new Date().getUTCDay();
  const category = ROTATION[dayIndex % ROTATION.length];

  // ---- 1. Generate 3 drafts.
  const planned = await planContent({ channel: "linkedin", category, maxDrafts: 3 });

  // ---- 2. Hallucination check (parallel).
  const checks = await Promise.all(
    planned.drafts.map((d) => checkHallucination({ body: d.body, category })),
  );

  // ---- 3. Persist all 3 with scores.
  const persisted = await Promise.all(planned.drafts.map(async (d, i) => {
    const check = checks[i];
    const confidence = planned.usedLlm ? 0.7 : 0.4;
    const row = await createDraft({
      title: firstSentence(d.body).slice(0, 80),
      hook:  firstSentence(d.body),
      body:  d.body,
      cta:   d.cta,
      hashtags: d.hashtags,
      category,
      confidence,
      createdByAgent: d.draftedByAgent,
    }, "cron:linkedin-daily-drafts");

    // Patch in the hallucination score after creation (createDraft doesn't accept it yet).
    await prisma.linkedInPostDraft.update({
      where: { id: row.id },
      data: {
        hallucinationScore: check.score,
        hallucinationNotes: check.notes,
        autopilotEligible:  Math.min(confidence, check.score) >= policy.confidenceThreshold,
      },
    });
    return { id: row.id, confidence, hallucinationScore: check.score };
  }));

  // ---- 4. Autopilot decision.
  const decision = decideAutopilotAction(persisted, policy, new Date());

  // ---- 5. Act on decision.
  let autopilotAuditPayload: {
    decision: "published" | "queued_for_review" | "killed" | "disabled" | "error";
    draftId?: string;
    scheduledFor?: Date;
    reason?: string;
    detail?: Record<string, unknown>;
  } = { decision: "disabled" };

  if (decision.kind === "scheduled") {
    // A recommendation is not independent approval or a qualified service
    // identity. Keep authoring useful without decrypting credentials, paid
    // image generation, provider upload or an automatic schedule transition.
    const queued = await prisma.linkedInPostDraft.updateMany({
      where: { id: decision.draftId, status: "drafted" },
      data: { status: "in_review" },
    });
    autopilotAuditPayload = {
      decision: queued.count === 1 ? "queued_for_review" : "error",
      draftId: decision.draftId,
      reason: queued.count === 1 ? "Independent platform review is required; no image or publication schedule was created." : "Draft changed before review queueing; no automatic schedule was created.",
      detail: {
        effectiveScore: decision.effectiveScore,
        threshold: policy.confidenceThreshold,
        suggestedScheduledFor: decision.scheduledFor.toISOString(),
        providerActionPerformed: false,
      },
    };
    if (queued.count === 1) await writeGrowthAudit({
      actor: "cron:linkedin-daily-drafts",
      action: "draft.edited",
      targetKind: "linkedin_draft",
      targetId: decision.draftId,
      detail: { queuedForIndependentReview: true, providerActionPerformed: false },
    });
  } else if (decision.kind === "queued_for_review") {
    autopilotAuditPayload = {
      decision: "queued_for_review",
      draftId: decision.draftId,
      reason: decision.reason,
      detail: { effectiveScore: decision.effectiveScore, threshold: policy.confidenceThreshold },
    };
  } else if (decision.kind === "disabled") {
    autopilotAuditPayload = {
      decision: "disabled",
      reason: decision.reason,
      detail: { threshold: policy.confidenceThreshold },
    };
  } else {
    autopilotAuditPayload = {
      decision: "error",
      reason: decision.reason,
      detail: {},
    };
  }

  // Write the autopilot decision row.
  await prisma.growthAutopilotDecision.create({
    data: {
      decision: autopilotAuditPayload.decision,
      draftId:  autopilotAuditPayload.draftId,
      draftsConsidered: persisted.length,
      bestConfidence: persisted[0]?.confidence ?? null,
      bestHallucinationScore: Math.max(0, ...persisted.map((p) => p.hallucinationScore ?? 0)),
      threshold: policy.confidenceThreshold,
      scheduledFor: autopilotAuditPayload.scheduledFor,
      reason: autopilotAuditPayload.reason,
      detail: autopilotAuditPayload.detail as object,
    },
  }).catch(() => { /* best-effort */ });

  await writeGrowthAudit({
    actor: "cron:linkedin-daily-drafts",
    action: "cron.daily_drafts_ran",
    detail: {
      category,
      generated: persisted.length,
      usedLlm: planned.usedLlm,
      autopilot: autopilotAuditPayload.decision,
    },
  });

  return NextResponse.json({
    ok: true,
    category,
    generated: persisted.length,
    autopilot: {
      enabled: false,
      policyEnabled: policy.enabled,
      executionStatus: "independent_review_required",
      threshold: policy.confidenceThreshold,
      decision: autopilotAuditPayload.decision,
      scheduledFor: autopilotAuditPayload.scheduledFor?.toISOString() ?? null,
      reason: autopilotAuditPayload.reason ?? null,
    },
    ranAt: new Date().toISOString(),
  });
}

function firstSentence(text: string): string {
  const m = text.match(/^([\s\S]{20,160}?[.!?])(\s|$)/);
  return (m?.[1] ?? text.slice(0, 140)).trim();
}
