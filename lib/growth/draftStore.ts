/**
 * Prisma-backed CRUD + state-machine for LinkedInPostDraft.
 *
 * Internal only. All mutations write a GrowthAuditLog row via the
 * best-effort writer in audit.ts.
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { LinkedInPostDraft } from "@prisma/client";
import { writeGrowthAudit } from "./audit";
import type { ContentTopicCategory } from "./growthModels";

// ---------------------------------------------------------------------------
// Closed-union status taxonomy at the LinkedIn-draft layer.
// ---------------------------------------------------------------------------

export type LinkedInDraftStatus =
  | "drafted"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "needs_revision"
  | "failed";

const TERMINAL: ReadonlySet<LinkedInDraftStatus> = new Set(["published", "rejected"]);

const VALID_TRANSITIONS: Readonly<Record<LinkedInDraftStatus, ReadonlyArray<LinkedInDraftStatus>>> = {
  drafted:        ["in_review", "approved", "rejected", "needs_revision"],
  in_review:      ["approved", "rejected", "needs_revision", "drafted"],
  approved:       ["scheduled", "published", "needs_revision", "rejected"],
  scheduled:      ["published", "approved", "failed", "rejected"],
  published:      [],
  rejected:       [],
  needs_revision: ["drafted", "in_review", "rejected"],
  failed:         ["approved", "scheduled", "rejected"],
};

export type TransitionResult =
  | { kind: "ok"; draft: LinkedInPostDraft }
  | { kind: "invalid_transition"; from: string; to: LinkedInDraftStatus }
  | { kind: "not_found" };

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateDraftInput {
  title: string;
  hook: string;
  body: string;
  cta?: string;
  hashtags?: readonly string[];
  category: ContentTopicCategory;
  targetAudience?: string;
  confidence?: number;
  campaignId?: string;
  createdByAgent?: string;
}

export async function createDraft(input: CreateDraftInput, actor: string): Promise<LinkedInPostDraft> {
  const row = await prisma.linkedInPostDraft.create({
    data: {
      title: input.title,
      hook: input.hook,
      body: input.body,
      cta: input.cta,
      hashtags: [...(input.hashtags ?? [])],
      category: input.category,
      targetAudience: input.targetAudience,
      confidence: input.confidence,
      campaignId: input.campaignId,
      createdByAgent: input.createdByAgent ?? "marketingContentDrafter",
      status: "drafted",
    },
  });
  await writeGrowthAudit({
    actor,
    action: "draft.created",
    targetKind: "linkedin_draft",
    targetId: row.id,
    detail: { category: input.category, agent: row.createdByAgent },
  });
  return row;
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

export interface EditDraftInput {
  title?: string;
  hook?: string;
  body?: string;
  cta?: string | null;
  hashtags?: readonly string[];
  targetAudience?: string | null;
}

export async function editDraft(id: string, patch: EditDraftInput, actor: string): Promise<LinkedInPostDraft | null> {
  const existing = await prisma.linkedInPostDraft.findUnique({ where: { id } });
  if (!existing) return null;
  if (TERMINAL.has(existing.status as LinkedInDraftStatus)) {
    // No edits to terminal rows.
    return existing;
  }
  const row = await prisma.linkedInPostDraft.update({
    where: { id },
    data: {
      title: patch.title,
      hook: patch.hook,
      body: patch.body,
      cta: patch.cta === undefined ? undefined : patch.cta,
      hashtags: patch.hashtags ? [...patch.hashtags] : undefined,
      targetAudience: patch.targetAudience === undefined ? undefined : patch.targetAudience,
    },
  });
  await writeGrowthAudit({
    actor,
    action: "draft.edited",
    targetKind: "linkedin_draft",
    targetId: id,
    detail: { changedFields: Object.keys(patch).join(",") },
  });
  return row;
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export async function transitionStatus(
  id: string,
  to: LinkedInDraftStatus,
  actor: string,
  extras: { scheduledFor?: Date; rejectionReason?: string; linkedinPostUrn?: string; linkedinPostUrl?: string } = {},
): Promise<TransitionResult> {
  const existing = await prisma.linkedInPostDraft.findUnique({ where: { id } });
  if (!existing) return { kind: "not_found" };

  const from = existing.status as LinkedInDraftStatus;
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return { kind: "invalid_transition", from, to };
  }

  const data: {
    status: LinkedInDraftStatus;
    scheduledFor?: Date | null;
    publishedAt?: Date | null;
    rejectionReason?: string | null;
    linkedinPostUrn?: string;
    linkedinPostUrl?: string;
    approvedByEmail?: string;
    approvedAt?: Date;
  } = { status: to };

  if (to === "scheduled") {
    if (!extras.scheduledFor) {
      return { kind: "invalid_transition", from, to };
    }
    data.scheduledFor = extras.scheduledFor;
  }
  if (to === "approved") {
    data.approvedByEmail = actor;
    data.approvedAt = new Date();
  }
  if (to === "published") {
    data.publishedAt = new Date();
    if (extras.linkedinPostUrn) data.linkedinPostUrn = extras.linkedinPostUrn;
    if (extras.linkedinPostUrl) data.linkedinPostUrl = extras.linkedinPostUrl;
  }
  if (to === "rejected") {
    data.rejectionReason = extras.rejectionReason ?? "no reason given";
  }

  const updated = await prisma.linkedInPostDraft.update({ where: { id }, data });

  const action =
    to === "approved"  ? "draft.approved" :
    to === "rejected"  ? "draft.rejected" :
    to === "scheduled" ? "draft.scheduled" :
    to === "published" ? "draft.publish_succeeded" :
    "draft.edited";

  await writeGrowthAudit({
    actor,
    action,
    targetKind: "linkedin_draft",
    targetId: id,
    detail: { from, to, ...(extras.rejectionReason ? { reason: extras.rejectionReason } : {}) },
  });

  return { kind: "ok", draft: updated };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listDrafts(opts: { status?: LinkedInDraftStatus; limit?: number } = {}): Promise<LinkedInPostDraft[]> {
  return prisma.linkedInPostDraft.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: [{ scheduledFor: "asc" }, { updatedAt: "desc" }],
    take: Math.min(opts.limit ?? 100, 500),
  });
}

export async function findDraft(id: string): Promise<LinkedInPostDraft | null> {
  return prisma.linkedInPostDraft.findUnique({ where: { id } });
}

export async function listDueScheduledDrafts(now: Date): Promise<LinkedInPostDraft[]> {
  return prisma.linkedInPostDraft.findMany({
    where: { status: "scheduled", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 50,
  });
}

// ---------------------------------------------------------------------------
// Pure kernel — exported for tests.
// ---------------------------------------------------------------------------

export function canTransition(from: string, to: LinkedInDraftStatus): boolean {
  const allowed = VALID_TRANSITIONS[from as LinkedInDraftStatus];
  return Boolean(allowed?.includes(to));
}
