import { prisma } from "@/lib/db";

type AuditActor = "system" | "user" | "admin";

type AuditParams = {
  leadId?: string | null;
  action: string;
  actor: AuditActor;
  metadata?: Record<string, unknown> | null;
};

/**
 * Phase 5: Non-blocking audit logging.
 * Logs: connector linked, export downloaded, implementation requested, roadmap generated, drift detected.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        leadId: params.leadId ?? null,
        action: params.action,
        actor: params.actor,
        metadata: (params.metadata as object) ?? undefined,
      },
    });
  } catch (e) {
    console.error("[audit] log failed:", e);
  }
}
