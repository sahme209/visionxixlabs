/**
 * GET/POST /api/cron/linkedin-daily-drafts
 *
 * Vercel cron — runs daily on weekdays. Pipeline:
 *
 *   1. planContent() → 3 LinkedIn drafts in today's category
 *   2. checkHallucination() on each (parallel) → score 0..1
 *   3. Persist all 3 with status=drafted + scores
 *   4. decideAutopilotAction() picks the strongest
 *   5. If scheduled:
 *        a. Generate a brand image for the best draft
 *        b. Upload to LinkedIn (if a connection exists + we have the binary)
 *        c. Set draft.status=scheduled, draft.scheduledFor=<next slot>
 *        d. Audit row written
 *      Else:
 *        a. Best draft stays drafted with autopilotEligible reflecting the score
 *        b. Audit row explains why
 *
 * Image generation + LinkedIn image upload both fail soft — autopilot
 * still schedules a text-only post if image gen fails. The cron never
 * publishes; it only schedules. The publish cron picks it up at the
 * scheduled time.
 *
 * Guarded by Bearer ${CRON_SECRET}.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { planContent } from "@/lib/growth/contentPlanner";
import { createDraft } from "@/lib/growth/draftStore";
import { writeGrowthAudit } from "@/lib/growth/audit";
import { checkHallucination } from "@/lib/growth/hallucinationCheck";
import { decideAutopilotAction, loadAutopilotPolicy } from "@/lib/growth/autopilot";
import { generateBrandImage } from "@/lib/growth/imageGenerator";
import { uploadImageToLinkedIn } from "@/lib/growth/linkedin/imageUpload";
import type { ContentTopicCategory } from "@/lib/growth/growthModels";
import { decryptCredential } from "@/lib/security/credentialVault";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // image gen + upload can take ~30-60s combined

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
    // Generate image for the chosen draft (fail soft).
    const winningDraft = await prisma.linkedInPostDraft.findUnique({ where: { id: decision.draftId } });
    let imageUrn: string | null = null;
    let imageUrl: string | null = null;
    let imagePrompt: string | null = null;
    let imageError: string | null = null;

    if (winningDraft) {
      const image = await generateBrandImage({ category, postSummary: winningDraft.body });
      if (image.kind === "ok") {
        imagePrompt = image.prompt;
        // Try uploading directly to LinkedIn (no intermediate hosting). Needs a connection.
        const connection = await prisma.linkedInAccountConnection.findFirst({
          where: { status: "connected" },
          orderBy: { updatedAt: "desc" },
        });
        if (connection) {
          let decryptedAccessToken: string | null = null;
          try {
            decryptedAccessToken = decryptCredential(connection.accessToken);
          } catch {
            // Covers real decryption failures and legacy rows written
            // before this connector's tokens were encrypted at rest.
            imageError = "linkedin_upload_token_decrypt_failed";
          }
          if (decryptedAccessToken) {
            const upload = await uploadImageToLinkedIn({
              accessToken: decryptedAccessToken,
              owner: connection.organizationUrn || connection.linkedinUrn,
              bytes: image.bytes,
            });
            if (upload.kind === "ok") {
              imageUrn = upload.urn;
            } else {
              imageError = `linkedin_upload_${upload.kind}`;
            }
          }
        } else {
          imageError = "no_connection_for_image_upload";
        }
      } else if (image.kind === "disabled") {
        imageError = `image_disabled: ${image.reason}`;
      } else {
        imageError = `image_error: ${image.message}`;
      }
    }

    // Update the winning draft → scheduled + image fields.
    await prisma.linkedInPostDraft.update({
      where: { id: decision.draftId },
      data: {
        status: "scheduled",
        scheduledFor: decision.scheduledFor,
        approvedByEmail: "autopilot",
        approvedAt: new Date(),
        imageUrn,
        imageUrl,
        imagePrompt,
      },
    });

    autopilotAuditPayload = {
      decision: "queued_for_review", // The post itself isn't published yet — the publish cron will pick it up.
      draftId: decision.draftId,
      scheduledFor: decision.scheduledFor,
      reason: `autopilot scheduled for ${decision.scheduledFor.toISOString()}`,
      detail: {
        effectiveScore: decision.effectiveScore,
        threshold: policy.confidenceThreshold,
        imageAttached: Boolean(imageUrn),
        imageError: imageError ?? "",
      },
    };

    await writeGrowthAudit({
      actor: "cron:linkedin-daily-drafts",
      action: "draft.scheduled",
      targetKind: "linkedin_draft",
      targetId: decision.draftId,
      detail: { autopilot: true, effectiveScore: decision.effectiveScore, imageAttached: Boolean(imageUrn) },
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
      enabled: policy.enabled,
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
