import { prisma } from "@/lib/db";
import type { ExecutionPlanItem, RiskLevel } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";
import type { CapturedState } from "./rollbackPlanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditLogStatus =
  | "pending"
  | "precheck_failed"
  | "applied"
  | "verified"
  | "failed"
  | "rolled_back";

export type CreateAuditLogInput = {
  userId: string;
  organizationId: string;
  item: ExecutionPlanItem;
  beforeState: CapturedState[] | Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AuditLogEntry = {
  id: string;
  userId: string;
  organizationId: string;
  planItemId: string;
  provider: CloudProvider;
  actionType: string;
  resourceIds: string[];
  region: string;
  beforeState: unknown;
  afterState: unknown;
  status: AuditLogStatus;
  errorMessage: string | null;
  riskLevel: RiskLevel;
  estimatedSavings: { monthly: number; yearly: number } | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  appliedAt: Date | null;
  verifiedAt: Date | null;
  rolledBackAt: Date | null;
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry> {
  const { userId, organizationId, item, beforeState, metadata } = input;

  const entry = await prisma.axiomAuditLog.create({
    data: {
      userId,
      organizationId,
      planItemId: item.id,
      provider: item.provider,
      actionType: item.actionType,
      resourceIds: item.resourceIds,
      region: item.region,
      beforeState: beforeState as object,
      status: "pending",
      riskLevel: item.riskLevel,
      estimatedSavings: item.estimatedSavings,
      metadata: (metadata as object) ?? undefined,
    },
  });

  return toEntry(entry);
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export async function markPrecheckFailed(
  id: string,
  errorMessage: string,
): Promise<AuditLogEntry> {
  return updateStatus(id, "precheck_failed", { errorMessage });
}

export async function markApplied(
  id: string,
  afterState: Record<string, unknown>,
): Promise<AuditLogEntry> {
  return updateStatus(id, "applied", {
    afterState: afterState as object,
    appliedAt: new Date(),
  });
}

export async function markVerified(id: string): Promise<AuditLogEntry> {
  return updateStatus(id, "verified", { verifiedAt: new Date() });
}

export async function markFailed(
  id: string,
  errorMessage: string,
): Promise<AuditLogEntry> {
  return updateStatus(id, "failed", { errorMessage });
}

export async function markRolledBack(
  id: string,
  metadata?: Record<string, unknown>,
): Promise<AuditLogEntry> {
  const existing = await prisma.axiomAuditLog.findUniqueOrThrow({ where: { id } });
  const merged = { ...(existing.metadata as object ?? {}), rollback: metadata };

  return updateStatus(id, "rolled_back", {
    rolledBackAt: new Date(),
    metadata: merged as object,
  });
}

// ---------------------------------------------------------------------------
// Generic status update
// ---------------------------------------------------------------------------

export async function updateAuditLogStatus(
  id: string,
  status: AuditLogStatus,
  fields?: {
    afterState?: Record<string, unknown>;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<AuditLogEntry> {
  const data: Record<string, unknown> = { status };

  if (fields?.afterState) data.afterState = fields.afterState as object;
  if (fields?.errorMessage) data.errorMessage = fields.errorMessage;
  if (fields?.metadata) data.metadata = fields.metadata as object;

  if (status === "applied") data.appliedAt = new Date();
  if (status === "verified") data.verifiedAt = new Date();
  if (status === "rolled_back") data.rolledBackAt = new Date();

  const entry = await prisma.axiomAuditLog.update({
    where: { id },
    data,
  });

  return toEntry(entry);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAuditLog(id: string): Promise<AuditLogEntry | null> {
  const entry = await prisma.axiomAuditLog.findUnique({ where: { id } });
  return entry ? toEntry(entry) : null;
}

export async function getAuditLogsByOrganization(
  organizationId: string,
  opts?: { limit?: number; offset?: number; status?: AuditLogStatus; provider?: CloudProvider },
): Promise<AuditLogEntry[]> {
  const where: Record<string, unknown> = { organizationId };
  if (opts?.status) where.status = opts.status;
  if (opts?.provider) where.provider = opts.provider;

  const entries = await prisma.axiomAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
  });

  return entries.map(toEntry);
}

export async function getAuditLogsByUser(
  userId: string,
  opts?: { limit?: number },
): Promise<AuditLogEntry[]> {
  const entries = await prisma.axiomAuditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
  });

  return entries.map(toEntry);
}

export async function getAuditLogsByPlanItem(planItemId: string): Promise<AuditLogEntry[]> {
  const entries = await prisma.axiomAuditLog.findMany({
    where: { planItemId },
    orderBy: { createdAt: "desc" },
  });

  return entries.map(toEntry);
}

// ---------------------------------------------------------------------------
// Summary for dashboard
// ---------------------------------------------------------------------------

export type AuditSummary = {
  totalActions: number;
  byStatus: Record<AuditLogStatus, number>;
  byProvider: Record<string, number>;
  totalEstimatedSavingsMonthly: number;
  recentFailures: AuditLogEntry[];
};

export async function getAuditSummary(organizationId: string): Promise<AuditSummary> {
  const entries = await prisma.axiomAuditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  const byStatus: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let totalSavings = 0;

  for (const entry of entries) {
    byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
    byProvider[entry.provider] = (byProvider[entry.provider] ?? 0) + 1;

    if (entry.status === "verified" || entry.status === "applied") {
      const savings = entry.estimatedSavings as { monthly?: number } | null;
      totalSavings += savings?.monthly ?? 0;
    }
  }

  const failures = entries
    .filter((e) => e.status === "failed" || e.status === "precheck_failed")
    .slice(0, 10)
    .map(toEntry);

  return {
    totalActions: entries.length,
    byStatus: byStatus as Record<AuditLogStatus, number>,
    byProvider,
    totalEstimatedSavingsMonthly: totalSavings,
    recentFailures: failures,
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function updateStatus(
  id: string,
  status: AuditLogStatus,
  data: Record<string, unknown>,
): Promise<AuditLogEntry> {
  const entry = await prisma.axiomAuditLog.update({
    where: { id },
    data: { status, ...data },
  });
  return toEntry(entry);
}

function toEntry(raw: Record<string, unknown>): AuditLogEntry {
  return {
    id: raw.id as string,
    userId: raw.userId as string,
    organizationId: raw.organizationId as string,
    planItemId: raw.planItemId as string,
    provider: raw.provider as CloudProvider,
    actionType: raw.actionType as string,
    resourceIds: raw.resourceIds as string[],
    region: raw.region as string,
    beforeState: raw.beforeState,
    afterState: raw.afterState ?? null,
    status: raw.status as AuditLogStatus,
    errorMessage: (raw.errorMessage as string) ?? null,
    riskLevel: raw.riskLevel as RiskLevel,
    estimatedSavings: raw.estimatedSavings as { monthly: number; yearly: number } | null,
    metadata: (raw.metadata as Record<string, unknown>) ?? null,
    createdAt: raw.createdAt as Date,
    appliedAt: (raw.appliedAt as Date) ?? null,
    verifiedAt: (raw.verifiedAt as Date) ?? null,
    rolledBackAt: (raw.rolledBackAt as Date) ?? null,
  };
}
