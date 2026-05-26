/**
 * Internal growth audit logger.
 *
 * Best-effort writer for the GrowthAuditLog table. Per CLAUDE.md: never
 * let an audit failure block a business event — every call is wrapped
 * in try/catch and silently absorbs DB outages.
 */

import "server-only";

import { prisma } from "@/lib/db";

export type GrowthAuditAction =
  | "draft.created"
  | "draft.edited"
  | "draft.approved"
  | "draft.rejected"
  | "draft.scheduled"
  | "draft.unscheduled"
  | "draft.publish_attempted"
  | "draft.publish_succeeded"
  | "draft.publish_failed"
  | "draft.publish_skipped"
  | "draft.manual_performance_entered"
  | "campaign.created"
  | "campaign.updated"
  | "campaign.archived"
  | "linkedin.connect_initiated"
  | "linkedin.connect_succeeded"
  | "linkedin.connect_failed"
  | "linkedin.disconnected"
  | "linkedin.token_refreshed"
  | "linkedin.analytics_synced"
  | "cron.daily_drafts_ran"
  | "cron.scheduled_publish_ran";

export type GrowthAuditTargetKind =
  | "linkedin_draft"
  | "linkedin_connection"
  | "linkedin_publish_run"
  | "growth_campaign"
  | "growth_analytics";

export interface GrowthAuditInput {
  actor: string;
  action: GrowthAuditAction;
  targetKind?: GrowthAuditTargetKind;
  targetId?: string;
  detail?: Record<string, string | number | boolean | null>;
}

export async function writeGrowthAudit(input: GrowthAuditInput): Promise<void> {
  try {
    await prisma.growthAuditLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        targetKind: input.targetKind,
        targetId: input.targetId,
        detail: input.detail ?? undefined,
      },
    });
  } catch {
    // Best-effort: never block a business event on an audit write.
  }
}
