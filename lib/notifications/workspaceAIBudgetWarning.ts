import "server-only";

import { isolatedRuntimeRequested } from "@/lib/billing/isolatedApplication/runtime";
import { workspaceAIUsageBudgetsEnabled } from "@/lib/billing/workspaceAIUsageBudget";
import { readWorkspaceBudgetSettings } from "@/lib/billing/workspaceAIUsageBudgetSettings";
import { prisma } from "@/lib/db";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

export async function readWorkspaceAIBudgetWarning(tenantId: OrganizationId, actorUserId: UserId | undefined) {
  if (!actorUserId || !workspaceAIUsageBudgetsEnabled() || isolatedRuntimeRequested()) return false;
  const result = await prisma.$transaction(
    tx => readWorkspaceBudgetSettings(tx, { organizationId: String(tenantId), userId: String(actorUserId) }),
    { isolationLevel: "Serializable" },
  );
  return result.kind === "ok" && result.data.budget?.warningReached === true;
}
