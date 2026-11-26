import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";

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
