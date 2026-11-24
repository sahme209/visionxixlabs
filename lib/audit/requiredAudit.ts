import "server-only";
import { randomUUID } from "node:crypto";
import type { AuditEventId } from "@/lib/domain/ids";
import type { Prisma } from "@/lib/prismaClient";
import { appendPrismaAuditRecord, prismaAuditStore } from "./auditStore.prisma";
import { prepareAuditRecord, type RecordInput } from "./secureAudit";

/** Sensitive cockpit writes must confirm durable audit persistence before reporting success.
 * This explicit adapter does not depend on instrumentation's module-local registration.
 * A failure propagates; callers must disclose when the preceding mutation may have committed.
 */
export async function recordRequiredAudit(input: RecordInput, transaction?: Pick<Prisma.TransactionClient, "secureAuditRecord">): Promise<void> {
  const eventId = `aud_${Date.now().toString(36)}_${randomUUID()}` as AuditEventId;
  const record = prepareAuditRecord(input, eventId);
  if (transaction) await appendPrismaAuditRecord(transaction, record);
  else await prismaAuditStore.append(record);
}
