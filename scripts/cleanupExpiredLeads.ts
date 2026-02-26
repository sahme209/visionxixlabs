#!/usr/bin/env npx ts-node
/**
 * Phase 7: Data retention policy.
 * Deletes leads older than LEAD_DATA_RETENTION_DAYS (default 365).
 * Exceptions: tier === enterprise OR userId exists.
 * Logs deletions to AuditLog.
 */

import { PrismaClient } from "@prisma/client";

const RETENTION_DAYS = parseInt(process.env.LEAD_DATA_RETENTION_DAYS ?? "365", 10);
const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const candidates = await prisma.lead.findMany({
    where: { createdAt: { lt: cutoff } },
  });

  let deleted = 0;
  for (const lead of candidates) {
    if (lead.userId) continue;
    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const tier = String(payload.tier ?? "").toLowerCase();
    if (tier === "enterprise") continue;

    try {
      await prisma.auditLog.create({
        data: {
          leadId: lead.id,
          action: "retention_deleted",
          actor: "system",
          metadata: { createdAt: lead.createdAt.toISOString(), retentionDays: RETENTION_DAYS },
        },
      });
      await prisma.axiomScoreSnapshot.deleteMany({ where: { leadId: lead.id } });
      await prisma.lead.delete({ where: { id: lead.id } });
      deleted++;
    } catch (e) {
      console.error(`[cleanup] failed to delete lead ${lead.id}:`, e);
    }
  }

  console.log(JSON.stringify({ event: "retention_cleanup_complete", deleted, retentionDays: RETENTION_DAYS }));
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ event: "retention_cleanup_error", error: String(e) }));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
