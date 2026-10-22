import "server-only";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { findAgentSkill } from "./skillCatalog";
interface InstallationRow { id: string; skillId: string; status: string; installedAt: Date; updatedAt: Date }
interface SkillRepo {
  agentSkillInstallation: {
    findMany(args: { where: { organizationId: string }; orderBy: { installedAt: "asc" } }): Promise<InstallationRow[]>;
    upsert(args: { where: { organizationId_skillId: { organizationId: string; skillId: string } }; create: { organizationId: string; skillId: string; status: string; installedByUserId: string }; update: { status: string; installedByUserId: string } }): Promise<InstallationRow>;
    updateMany(args: { where: { organizationId: string; skillId: string }; data: { status: string } }): Promise<{ count: number }>;
    deleteMany(args: { where: { organizationId: string; skillId: string } }): Promise<{ count: number }>;
  };
}

export async function updateWorkspaceSkill({organizationId,userId,skillId,action}: {organizationId:string;userId:string;skillId:string;action:string}):Promise<{ok:boolean;data?:{skillId:string;status:string};error?:string;statusCode:number}> {
 if(!organizationId || !userId || !findAgentSkill(skillId) || !["install","enable","disable","remove"].includes(action)) return {ok:false,error:"invalid_payload",statusCode:400};
  const repo = prisma as unknown as SkillRepo;
  try {
    let status = "not_installed";
    if (action === "install" || action === "enable") {
      await repo.agentSkillInstallation.upsert({
        where: { organizationId_skillId: { organizationId: organizationId, skillId } },
        create: { organizationId: organizationId, skillId, status: "enabled", installedByUserId: userId },
        update: { status: "enabled", installedByUserId: userId },
      });
      status = "enabled";
    } else if (action === "disable") {
      const result = await repo.agentSkillInstallation.updateMany({ where: { organizationId: organizationId, skillId }, data: { status: "disabled" } });
      if (result.count !== 1) return { ok: false, error: "skill_not_installed", statusCode: 409 };
      status = "disabled";
    } else {
      const result = await repo.agentSkillInstallation.deleteMany({ where: { organizationId: organizationId, skillId } });
      if (result.count !== 1) return { ok: false, error: "skill_not_installed", statusCode: 409 };
    }
    await recordAudit({
      organizationId: idFactory.organization(organizationId), actorUserId: idFactory.user(userId), actorKind: "user",
      action: `skill.${action}` as "skill.install" | "skill.enable" | "skill.disable" | "skill.remove", outcome: "success",
      entityRef: `skill:${skillId}`, correlationId: idFactory.correlation(`skill_${action}_${Date.now().toString(36)}`), source: "live",
      detail: { skillId, status, authorityChanged: false },
    });
    return { ok: true, data: { skillId, status }, statusCode: 200 };
  } catch {
    return { ok: false, error: "skill_update_unavailable", statusCode: 503 };
  }
}
