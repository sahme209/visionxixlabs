import "server-only";
import { prisma } from "@/lib/db";
import { recordRequiredAudit as recordAudit } from "@/lib/audit/requiredAudit";
import type { RecordInput } from "@/lib/audit/secureAudit";
import type { Prisma } from "@/lib/prismaClient";
import { id as idFactory } from "@/lib/domain/ids";
import { findAgentSkill } from "./skillCatalog";

type SkillAction = "install" | "enable" | "disable" | "remove";
type SkillStatus = "enabled" | "disabled" | "not_installed";

interface SkillIdentifier {
  organizationId: string;
  skillId: string;
}

const ACTION_STATUS: Record<SkillAction, SkillStatus> = {
  install: "enabled", enable: "enabled", disable: "disabled", remove: "not_installed",
};

function isSkillAction(action: string): action is SkillAction {
  return Object.hasOwn(ACTION_STATUS, action);
}

class SkillAuditUnconfirmed extends Error {}

export async function updateWorkspaceSkill({
  organizationId, userId, skillId, action,
}: SkillIdentifier & {userId: string; action: string}): Promise<{
  ok: boolean; data?: {skillId: string; status: string}; error?: string; statusCode: number;
}> {
  if (!organizationId || !userId || !findAgentSkill(skillId) || !isSkillAction(action)) {
    return {ok: false, error: "invalid_payload", statusCode: 400};
  }

  const key = {organizationId, skillId};
  const status = ACTION_STATUS[action];
  async function mutate({agentSkillInstallation: installations}: Pick<Prisma.TransactionClient, "agentSkillInstallation">) {
    if (action === "install") {
      // A competing install or a disabled installation must not be overwritten.
      return installations.createMany({
        data: {...key, status: "enabled", installedByUserId: userId}, skipDuplicates: true,
      });
    }
    if (action === "remove") return installations.deleteMany({where: key});
    const expected = action === "enable" ? "disabled" : "enabled";
    return installations.updateMany({where: {...key, status: expected}, data: {status}});
  }
  const audit: RecordInput = {
    organizationId: idFactory.organization(organizationId), actorUserId: idFactory.user(userId), actorKind: "user",
    action: `skill.${action}`, outcome: "success",
    entityRef: `skill:${skillId}`, correlationId: idFactory.correlation(`skill_${action}_${Date.now().toString(36)}`), source: "live",
    detail: {skillId, status, authorityChanged: false},
  };
  try {
    // Installing or enabling guidance requires durable audit in the same transaction.
    // Disable and remove must still reduce access when audit storage is unavailable.
    const {count} = status === "enabled"
      ? await prisma.$transaction(async transaction => {
        const result = await mutate(transaction);
        if (result.count === 1) {
          try { await recordAudit(audit, transaction); }
          catch { throw new SkillAuditUnconfirmed(); }
        }
        return result;
      })
      : await mutate(prisma);
    if (count !== 1) return {ok: false, error: "skill_state_changed", statusCode: 409};

    if (status !== "enabled") {
      try { await recordAudit(audit); }
      catch { throw new SkillAuditUnconfirmed(); }
    }
    return {ok: true, data: {skillId, status}, statusCode: 200};
  } catch (error) {
    return {ok: false, error: error instanceof SkillAuditUnconfirmed ? "skill_audit_unconfirmed" : "skill_update_unavailable", statusCode: 503};
  }
}
