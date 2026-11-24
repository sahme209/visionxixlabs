import {createHash} from "node:crypto";
import {NextResponse, type NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {readBoundedRequestJson} from "@/lib/api/readBoundedRequestJson";
import {captureCurrentDesktopSessionFreshness} from "@/lib/desktop/currentSessionFreshness";
import {resolveRequestDesktopSession} from "@/lib/desktop/resolveRequestDesktopSession";
import {aggregateIncidentTriageInputs, type IncidentTriageAggregateRepo} from "@/lib/releaseops/incidentTriageAggregator";
import {buildTriageGenerateResponse, type IncidentTriageRepo} from "@/lib/releaseops/incidentTriageResponder";
import {buildIncidentReportResponse, type DeploymentIncidentRepo} from "@/lib/releaseops/deploymentIncidentResponder";
import {canReportDeploymentIncident, incidentReportReceipt, incidentReportReleases, incidentReportRequest} from "@/lib/tauri/incidentReportContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const policy = {
  route: "/api/desktop/tickets/incident-report",
  requiredScope: "pipeline:read",
  requiredCapability: "workspace:read",
  requireWorkspaceMembership: true,
  allowApiKey: false,
  recordHeartbeat: false,
} as const;

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
}
async function reporter(request: NextRequest) {
  const actor = await resolveRequestDesktopSession(request, policy);
  if (actor?.credentialKind === "desktop_session" && actor.capabilities.includes("workspace:read") &&
      canReportDeploymentIncident(actor.role)) return actor;
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.search) return reply({ok: false, error: "invalid_report_request"}, 400);
  try {
    const actor = await reporter(request);
    if (!actor) return reply({ok: false, error: "incident_permission_required"}, 403);
    const rows = await prisma.release.findMany({
      where: {organizationId: actor.organizationId},
      select: {id: true, organizationId: true, releaseTag: true},
      orderBy: [{createdAt: "desc"}, {id: "desc"}], take: 80,
    });
    const current = await reporter(request);
    if (current?.id !== actor.id || current.userId !== actor.userId || current.organizationId !== actor.organizationId) {
      return reply({ok: false, error: "incident_permission_required"}, 403);
    }
    const data = incidentReportReleases.parse({workspaceId: actor.organizationId, actorId: actor.userId,
      releases: rows.filter(row => row.organizationId === actor.organizationId)
        .map(row => ({id: row.id, tag: row.releaseTag?.slice(0, 120) ?? null}))});
    return reply({ok: true, data});
  } catch {
    return reply({ok: false, error: "incident_report_unavailable"}, 503);
  }
}

class ReportRefusal extends Error {
  constructor(readonly status: number, code: string) { super(code); }
}

export async function POST(request: NextRequest) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  if (request.nextUrl.search) return reply({ok: false, error: "invalid_report_request"}, 400);
  try {
    const actor = await reporter(request);
    if (!actor) return reply({ok: false, error: "incident_permission_required"}, 403);
    const parsed = incidentReportRequest.safeParse(await readBoundedRequestJson(request, signal, 8192).catch(() => null));
    if (!parsed.success) return reply({ok: false, error: "invalid_report_request"}, 400);
    const report = parsed.data;
    const {organizationId, userId} = actor;
    if (report.workspaceId !== organizationId || report.actorId !== userId) {
      return reply({ok: false, error: "incident_permission_required"}, 403);
    }
    const recordId = "inc_" + createHash("sha256").update(JSON.stringify([organizationId, userId, report.attemptId])).digest("hex");
    const created = await prisma.$transaction(async tx => {
      const [membership] = await tx.$queryRaw<Array<{role: string; acceptedAt: Date | null}>>`
        SELECT "role"::text AS "role", "acceptedAt" FROM "OrgMembership"
        WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
      if (!membership?.acceptedAt || !canReportDeploymentIncident(membership.role)) {
        throw new ReportRefusal(403, "incident_membership_required");
      }
      const fresh = await captureCurrentDesktopSessionFreshness(tx,
        {organizationId, actorUserId: userId, sessionId: actor.id}, signal)
        .catch(() => {throw new ReportRefusal(403, "incident_session_required");});
      const [release] = await tx.$queryRaw<Array<{id: string; organizationId: string}>>`
        SELECT "id", "organizationId" FROM "Release"
        WHERE "id" = ${report.releaseId} AND "organizationId" = ${organizationId} FOR SHARE`;
      if (!release) throw new ReportRefusal(404, "incident_release_not_found");
      fresh();

      let inserted = false;
      let conflict = false;
      const repo: DeploymentIncidentRepo = {
        release: {findUnique: async () => release},
        deploymentIncident: {
          ...tx.deploymentIncident,
          create: async ({data}) => {
            const result = await tx.deploymentIncident.createMany({data: {...data, id: recordId}, skipDuplicates: true});
            const row = await tx.deploymentIncident.findFirst({where: {id: recordId, organizationId}});
            if (!row || row.reportedByUserId !== userId || row.releaseId !== data.releaseId ||
              row.severity !== data.severity || row.title !== data.title || row.summary !== data.summary) {
              conflict = true;
              throw new Error("incident_attempt_conflict");
            }
            inserted = result.count === 1;
            return row;
          },
        },
      };
      const result = await buildIncidentReportResponse(repo, {
        organizationId, reportedByUserId: userId, releaseId: report.releaseId,
        severity: report.severity, title: report.title, summary: report.summary,
      });
      if (conflict) throw new ReportRefusal(409, "incident_attempt_conflict");
      if (!result.body.ok) throw new ReportRefusal(503, "incident_report_unavailable");
      if (inserted) await tx.auditEvent.create({data: {
        organizationId, actorUserId: userId, kind: "deployment_incident.report",
        subjectKind: "release", subjectId: release.id, correlationId: report.attemptId,
        summary: "Deployment incident reported in Studio",
      }});
      fresh();
      return inserted;
    });

    if (created) {
      try {
        const aggregated = await aggregateIncidentTriageInputs(prisma as unknown as IncidentTriageAggregateRepo, {
          organizationId, incidentId: recordId, businessImpactHint: report.summary || null,
        });
        if (aggregated.ok) await buildTriageGenerateResponse(prisma as unknown as IncidentTriageRepo, {
          organizationId, incidentId: recordId, engineInputs: aggregated.inputs,
        });
      } catch {
        // The incident and its audit event are already recorded.
      }
    }
    const current = await reporter(request);
    if (current?.id !== actor.id || current.userId !== userId || current.organizationId !== organizationId) {
      return reply({ok: false, error: "incident_permission_required"}, 403);
    }
    const data = incidentReportReceipt.parse({workspaceId: organizationId, actorId: userId,
      attemptId: report.attemptId, releaseId: report.releaseId, incidentId: recordId});
    return reply({ok: true, data}, created ? 201 : 200);
  } catch (error) {
    if (error instanceof ReportRefusal) return reply({ok: false, error: error.message}, error.status);
    return reply({ok: false, error: "incident_report_unavailable"}, 503);
  }
}
