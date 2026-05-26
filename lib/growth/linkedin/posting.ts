/**
 * LinkedIn UGC posting — internal admin publish path.
 *
 * Uses the official Posts API (https://api.linkedin.com/rest/posts). When
 * LINKEDIN_POSTING_ENABLED !== "true", every call short-circuits with
 * `skipped_disabled` so dev / staging never accidentally posts. When no
 * LinkedInAccountConnection row exists for the actor, returns
 * `skipped_not_connected`.
 *
 * On every attempt — success or failure — a LinkedInPostPublishRun row
 * is written, plus a GrowthAuditLog row via writeGrowthAudit().
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { LinkedInPostDraft, LinkedInAccountConnection } from "@prisma/client";
import { isPostingEnabled } from "./oauth";
import { writeGrowthAudit } from "../audit";
import { transitionStatus } from "../draftStore";

const POSTS_URL = "https://api.linkedin.com/rest/posts";
const LINKEDIN_REST_VERSION = "202405";

export type PublishOutcome =
  | { kind: "success"; urn: string; url?: string; runId: string }
  | { kind: "skipped_disabled"; runId: string }
  | { kind: "skipped_not_connected"; runId: string }
  | { kind: "token_expired"; runId: string }
  | { kind: "http_error"; status: number; body: string; runId: string }
  | { kind: "network_error"; message: string; runId: string };

export interface PublishInput {
  draftId: string;
  triggeredBy: string; // "operator:<email>" | "cron:linkedin-publish"
}

/**
 * Publish a draft to LinkedIn. Always writes a publish run row.
 * Returns a closed-union outcome.
 */
export async function publishDraft(input: PublishInput): Promise<PublishOutcome> {
  const draft = await prisma.linkedInPostDraft.findUnique({ where: { id: input.draftId } });
  if (!draft) {
    const run = await recordRun(input.draftId, input.triggeredBy, "failed", { errorDetail: "draft_not_found" });
    return { kind: "http_error", status: 404, body: "draft_not_found", runId: run.id };
  }

  if (!isPostingEnabled()) {
    const run = await recordRun(draft.id, input.triggeredBy, "skipped_disabled", {});
    await writeGrowthAudit({
      actor: input.triggeredBy,
      action: "draft.publish_skipped",
      targetKind: "linkedin_draft",
      targetId: draft.id,
      detail: { reason: "LINKEDIN_POSTING_ENABLED!=true" },
    });
    return { kind: "skipped_disabled", runId: run.id };
  }

  const connection = await pickConnection();
  if (!connection) {
    const run = await recordRun(draft.id, input.triggeredBy, "skipped_not_connected", {});
    await writeGrowthAudit({
      actor: input.triggeredBy,
      action: "draft.publish_skipped",
      targetKind: "linkedin_draft",
      targetId: draft.id,
      detail: { reason: "no_active_linkedin_connection" },
    });
    return { kind: "skipped_not_connected", runId: run.id };
  }

  if (connection.expiresAt.getTime() < Date.now()) {
    await prisma.linkedInAccountConnection.update({
      where: { id: connection.id },
      data:  { status: "expired", lastError: "access token expired" },
    });
    const run = await recordRun(draft.id, input.triggeredBy, "failed", { errorDetail: "token_expired" });
    return { kind: "token_expired", runId: run.id };
  }

  const author = connection.organizationUrn || connection.linkedinUrn;
  const text = renderPostText(draft);

  const payload: Record<string, unknown> = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  // Attach image if the draft has one already uploaded to LinkedIn.
  if (draft.imageUrn) {
    payload.content = {
      media: {
        id: draft.imageUrn,
        altText: draft.title.slice(0, 200),
      },
    };
  }

  try {
    const res = await fetch(POSTS_URL, {
      method: "POST",
      headers: {
        Authorization:          `Bearer ${connection.accessToken}`,
        "Content-Type":         "application/json",
        "LinkedIn-Version":     LINKEDIN_REST_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const run = await recordRun(draft.id, input.triggeredBy, "failed", {
        httpStatus: res.status,
        errorDetail: text.slice(0, 1000),
      });
      await writeGrowthAudit({
        actor: input.triggeredBy,
        action: "draft.publish_failed",
        targetKind: "linkedin_draft",
        targetId: draft.id,
        detail: { httpStatus: res.status },
      });
      // Bump draft to failed if it was scheduled.
      if (draft.status === "scheduled") {
        await transitionStatus(draft.id, "failed", input.triggeredBy);
      }
      await prisma.linkedInAccountConnection.update({
        where: { id: connection.id },
        data:  { lastUsedAt: new Date(), lastError: `HTTP ${res.status}`, status: res.status === 401 ? "expired" : connection.status },
      });
      return { kind: "http_error", status: res.status, body: text.slice(0, 500), runId: run.id };
    }

    // Posts API returns the URN in the `x-restli-id` header.
    const urn = res.headers.get("x-restli-id") ?? (await safeParseUrn(res));
    const run = await recordRun(draft.id, input.triggeredBy, "success", {
      httpStatus: res.status,
      linkedinPostUrn: urn ?? undefined,
    });
    await prisma.linkedInAccountConnection.update({
      where: { id: connection.id },
      data:  { lastUsedAt: new Date(), lastError: null, status: "connected" },
    });
    if (urn) {
      await transitionStatus(draft.id, "published", input.triggeredBy, {
        linkedinPostUrn: urn,
      });
    }
    await writeGrowthAudit({
      actor: input.triggeredBy,
      action: "draft.publish_succeeded",
      targetKind: "linkedin_draft",
      targetId: draft.id,
      detail: urn ? { urn } : {},
    });
    return { kind: "success", urn: urn ?? "unknown", runId: run.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const run = await recordRun(draft.id, input.triggeredBy, "failed", { errorDetail: message });
    if (draft.status === "scheduled") {
      await transitionStatus(draft.id, "failed", input.triggeredBy);
    }
    return { kind: "network_error", message, runId: run.id };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function pickConnection(): Promise<LinkedInAccountConnection | null> {
  return prisma.linkedInAccountConnection.findFirst({
    where: { status: "connected" },
    orderBy: { updatedAt: "desc" },
  });
}

async function recordRun(
  draftId: string,
  triggeredBy: string,
  outcome: "pending" | "success" | "failed" | "skipped_disabled" | "skipped_not_connected",
  extras: { httpStatus?: number; errorDetail?: string; linkedinPostUrn?: string } = {},
): Promise<{ id: string }> {
  const row = await prisma.linkedInPostPublishRun.create({
    data: {
      draftId,
      triggeredBy,
      outcome,
      httpStatus: extras.httpStatus,
      errorDetail: extras.errorDetail,
      linkedinPostUrn: extras.linkedinPostUrn,
      finishedAt: new Date(),
    },
  });
  return { id: row.id };
}

async function safeParseUrn(res: Response): Promise<string | null> {
  try {
    const json = (await res.json()) as { id?: string };
    return json.id ?? null;
  } catch {
    return null;
  }
}

/** Pure: render the on-LinkedIn text from a draft row. */
export function renderPostText(draft: Pick<LinkedInPostDraft, "hook" | "body" | "cta" | "hashtags">): string {
  const parts: string[] = [];
  if (draft.hook) parts.push(draft.hook);
  if (draft.body) parts.push(draft.body);
  if (draft.cta) parts.push(draft.cta);
  if (draft.hashtags.length > 0) {
    parts.push(draft.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" "));
  }
  return parts.join("\n\n").trim();
}
