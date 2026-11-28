import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { readStoredAutopilot, type StoredAutopilot } from "@/lib/releaseops/policyAsCode";

export async function policyAdminContext() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) return null;
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) return null;
  return { organizationId: String(context.organizationId), userId: String(context.userId) };
}

export function readPolicyRules(organizationId: string) {
  return (prisma as unknown as { policyRule: { findMany(args: unknown): Promise<Array<{ key: string; label: string; severity: string; blocking: boolean; exceptionAllowed: boolean; approverRole: string | null; evidenceRequired: boolean; enabled: boolean; description: string | null }>> } })
    .policyRule.findMany({ where: { organizationId }, orderBy: { key: "asc" }, take: 500,
      select: { key: true, label: true, severity: true, blocking: true, exceptionAllowed: true, approverRole: true, evidenceRequired: true, enabled: true, description: true } });
}

/** Recorded violations from releases detected in the last 90 days, for backtesting a proposed policy. */
export async function readBacktestHistory(organizationId: string, now = new Date()) {
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const rows = await (prisma as unknown as { policyViolation: { findMany(args: unknown): Promise<Array<{ releaseId: string; exceptionGrantedAt: Date | null; rule: { key: string } }>> } })
    .policyViolation.findMany({ where: { organizationId, detectedAt: { gte: since } }, take: 20_000, select: { releaseId: true, exceptionGrantedAt: true, rule: { select: { key: true } } } });
  return { violations: rows.map((r) => ({ releaseId: r.releaseId, ruleKey: r.rule.key, exceptionGranted: r.exceptionGrantedAt !== null })), releaseIds: rows.map((r) => r.releaseId) };
}

/** The workspace's release autopilot, or null when off. */
export async function readAutopilot(organizationId: string, client: { workspaceReleaseAutopilot: { findUnique(args: unknown): Promise<{ deployEnvironments: string[]; maxFiles: number } | null> } } = prisma as never): Promise<StoredAutopilot | null> {
  return readStoredAutopilot(await client.workspaceReleaseAutopilot.findUnique({ where: { organizationId }, select: { deployEnvironments: true, maxFiles: true } }));
}
