import "server-only";
import { prisma } from "@/lib/db";
import type { RepoCoordinates } from "./parseRepoRef";

/** Saved read evidence is a content pin, not an approval or a permission grant. */
export async function loadCodingReadSnapshot(organizationId: string, runId: string, target: RepoCoordinates): Promise<{ branch: string; headSha: string } | null> {
  try {
    const prior = await prisma.pipelineStageRun.findFirst({ where: { runId, run: { organizationId }, stageKind: "code_read", status: "succeeded" }, orderBy: { completedAt: "desc" }, select: { outputDetail: true } });
    const base = prior?.outputDetail as Record<string, unknown> | null;
    if (!base || base.owner !== target.owner || base.repo !== target.repo || typeof base.branch !== "string" || !base.branch.trim() || typeof base.headSha !== "string" || !/^[a-f0-9]{40}$/.test(base.headSha)) return null;
    return { branch: base.branch, headSha: base.headSha };
  } catch { return null; }
}
