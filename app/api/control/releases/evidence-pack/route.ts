import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { buildReleaseEvidencePack } from "@/lib/releaseops/releaseEvidencePack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const SHA = /^[0-9a-fA-F]{40}$/;

/**
 * GET /api/control/releases/evidence-pack?repository=owner/name&commit=<40-hex>
 * Downloads the release evidence pack for one commit. Workspace members can export; the export itself is
 * audited (best-effort). Read-only: nothing is changed.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return fail("workspace_membership_required", 403);
  const organizationId = String(c.organizationId);
  const repositoryFullName = request.nextUrl.searchParams.get("repository")?.trim() ?? "";
  const commit = request.nextUrl.searchParams.get("commit")?.trim() ?? "";
  if (!REPO.test(repositoryFullName) || !SHA.test(commit)) return fail("repository_and_full_commit_required", 400);
  const commitSha = commit.toLowerCase();
  try {
    const executions = await prisma.deploymentExecution.findMany({
      where: { organizationId, repositoryFullName, sourceCommitSha: { in: [commitSha, commit] } },
      orderBy: { createdAt: "asc" }, take: 500,
      select: { id: true, environmentId: true, sourceRef: true, triggeredByUserId: true, source: true, status: true, conclusion: true, rollbackStatus: true, branchPolicyId: true, pullRequestUrl: true, workflowUrl: true, configDigest: true, createdAt: true, completedAt: true },
    });
    const envIds = [...new Set(executions.map((e) => e.environmentId))];
    const [environments, results, events] = await Promise.all([
      envIds.length ? prisma.environment.findMany({ where: { organizationId, id: { in: envIds } }, select: { id: true, name: true, tier: true } }) : Promise.resolve([]),
      prisma.deploymentCheckResult.findMany({ where: { organizationId, releaseRef: { in: [commitSha, commit] } }, orderBy: { reportedAt: "asc" }, take: 1000, select: { checkKey: true, checkVersion: true, stage: true, status: true, environmentSlug: true, runUrl: true, reportedAt: true } }),
      executions.length ? prisma.auditEvent.findMany({ where: { organizationId, subjectId: { in: executions.map((e) => e.id) } }, orderBy: { createdAt: "asc" }, take: 1000, select: { kind: true, subjectId: true, outcome: true, summary: true, actorUserId: true, createdAt: true } }) : Promise.resolve([]),
    ]);
    const envById = new Map(environments.map((e) => [e.id, e]));
    const { body, digest, pack } = buildReleaseEvidencePack({
      organizationId, repositoryFullName, commitSha, generatedAt: new Date().toISOString(),
      deployments: executions.map((e) => ({
        id: e.id, environment: envById.get(e.environmentId)?.name ?? e.environmentId, environmentTier: envById.get(e.environmentId)?.tier ?? null,
        sourceRef: e.sourceRef, triggeredByUserId: e.triggeredByUserId, source: e.source, status: e.status, conclusion: e.conclusion, rollbackStatus: e.rollbackStatus,
        branchPolicyId: e.branchPolicyId, pullRequestUrl: e.pullRequestUrl, workflowUrl: e.workflowUrl, configDigest: e.configDigest,
        createdAt: e.createdAt.toISOString(), completedAt: e.completedAt ? e.completedAt.toISOString() : null,
      })),
      checkResults: results.map((r) => ({ checkKey: r.checkKey, checkVersion: r.checkVersion, stage: r.stage, status: r.status, environment: r.environmentSlug, runUrl: r.runUrl, reportedAt: r.reportedAt.toISOString() })),
      auditEvents: events.map((e) => ({ kind: e.kind, subjectId: e.subjectId, outcome: e.outcome, summary: e.summary, actorUserId: e.actorUserId, createdAt: e.createdAt.toISOString() })),
    });
    try {
      await auditRecord({ organizationId: organizationId as OrganizationId, actorUserId: String(c.userId) as UserId, action: "audit.export", outcome: "success", entityRef: `release_evidence:${repositoryFullName}@${commitSha}`, correlationId: randomUUID() as CorrelationId, detail: { digest, deployments: pack.summary.deployments } });
    } catch { /* best-effort */ }
    const name = `v19-evidence-${repositoryFullName.replace("/", "-")}-${commitSha.slice(0, 12)}.json`;
    return new NextResponse(body, { status: 200, headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "X-V19-Evidence-Digest": digest } });
  } catch {
    return fail("evidence_unavailable", 503);
  }
}
