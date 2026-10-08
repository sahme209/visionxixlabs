import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { AGENT_SKILL_CATALOG, findAgentSkill } from "@/lib/axiom/agentRuntime/skillCatalog";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface InstallationRow { id: string; skillId: string; status: string; installedAt: Date; updatedAt: Date }
interface SkillRepo {
  agentSkillInstallation: {
    findMany(args: { where: { organizationId: string }; orderBy: { installedAt: "asc" } }): Promise<InstallationRow[]>;
    upsert(args: { where: { organizationId_skillId: { organizationId: string; skillId: string } }; create: { organizationId: string; skillId: string; status: string; installedByUserId: string }; update: { status: string; installedByUserId: string } }): Promise<InstallationRow>;
    updateMany(args: { where: { organizationId: string; skillId: string }; data: { status: string } }): Promise<{ count: number }>;
    deleteMany(args: { where: { organizationId: string; skillId: string } }): Promise<{ count: number }>;
  };
}

async function resolveSession(request: NextRequest, admin: boolean) {
  return resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: `${request.method} /api/desktop/agent/skills`,
    allowApiKey: false,
    requireWorkspaceAdmin: admin,
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveSession(request, false);
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  let rows: InstallationRow[] = [];
  let storageAvailable = true;
  try {
    rows = await (prisma as unknown as SkillRepo).agentSkillInstallation.findMany({ where: { organizationId: session.organizationId }, orderBy: { installedAt: "asc" } });
  } catch {
    // The curated catalog is static and safe to show even while installation
    // storage is unavailable (for example during a migration rollout). Never
    // fabricate installed state: every item remains explicitly not installed.
    storageAvailable = false;
  }
  const byId = new Map(rows.map((row) => [row.skillId, row]));
  return NextResponse.json({ ok: true, data: { storageAvailable, skills: AGENT_SKILL_CATALOG.map((skill) => {
    const installation = byId.get(skill.id);
    return {
      id: skill.id, name: skill.name, description: skill.description, category: skill.category,
      toolNames: [...skill.toolNames], status: installation?.status ?? "not_installed",
      installedAt: installation?.installedAt.toISOString() ?? null, updatedAt: installation?.updatedAt.toISOString() ?? null,
    };
  }) } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveSession(request, true);
  if (!session) return NextResponse.json({ ok: false, error: "desktop_admin_session_required" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { skillId?: unknown; action?: unknown } | null;
  const skillId = typeof body?.skillId === "string" ? body.skillId : "";
  const action = body?.action;
  if (!findAgentSkill(skillId) || !["install", "enable", "disable", "remove"].includes(String(action))) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const repo = prisma as unknown as SkillRepo;
  try {
    let status = "not_installed";
    if (action === "install" || action === "enable") {
      await repo.agentSkillInstallation.upsert({
        where: { organizationId_skillId: { organizationId: session.organizationId, skillId } },
        create: { organizationId: session.organizationId, skillId, status: "enabled", installedByUserId: session.userId },
        update: { status: "enabled", installedByUserId: session.userId },
      });
      status = "enabled";
    } else if (action === "disable") {
      const result = await repo.agentSkillInstallation.updateMany({ where: { organizationId: session.organizationId, skillId }, data: { status: "disabled" } });
      if (result.count !== 1) return NextResponse.json({ ok: false, error: "skill_not_installed" }, { status: 409 });
      status = "disabled";
    } else {
      const result = await repo.agentSkillInstallation.deleteMany({ where: { organizationId: session.organizationId, skillId } });
      if (result.count !== 1) return NextResponse.json({ ok: false, error: "skill_not_installed" }, { status: 409 });
    }
    await recordAudit({
      organizationId: idFactory.organization(session.organizationId), actorUserId: idFactory.user(session.userId), actorKind: "user",
      action: `skill.${action}` as "skill.install" | "skill.enable" | "skill.disable" | "skill.remove", outcome: "success",
      entityRef: `skill:${skillId}`, correlationId: idFactory.correlation(`skill_${action}_${Date.now().toString(36)}`), source: "live",
      detail: { skillId, status, authorityChanged: false },
    });
    return NextResponse.json({ ok: true, data: { skillId, status } });
  } catch {
    return NextResponse.json({ ok: false, error: "skill_update_unavailable" }, { status: 503 });
  }
}
