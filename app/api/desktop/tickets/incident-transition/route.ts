import {createHash} from "node:crypto";
import {NextResponse, type NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {readBoundedRequestJson} from "@/lib/api/readBoundedRequestJson";
import {captureCurrentDesktopSessionFreshness} from "@/lib/desktop/currentSessionFreshness";
import {resolveRequestDesktopSession} from "@/lib/desktop/resolveRequestDesktopSession";
import {planTransition} from "@/lib/releaseops/deploymentIncidentLifecycle";
import {
  canChangeIncidentStatus, incidentTransitionReceipt, incidentTransitionRequest, matchesIncidentTransition,
} from "@/lib/tauri/incidentTransitionContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const policy = {
  route: "/api/desktop/tickets/incident-transition", requiredScope: "pipeline:read",
  requiredCapability: "workspace:read", requireWorkspaceMembership: true, allowApiKey: false, recordHeartbeat: false,
} as const;

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
}

async function operator(request: NextRequest) {
  const actor = await resolveRequestDesktopSession(request, policy);
  if (actor?.credentialKind === "desktop_session" && actor.capabilities.includes("workspace:read") && canChangeIncidentStatus(actor.role)) return actor;
}

class Refusal extends Error {
  constructor(readonly status: number, code: string) { super(code); }
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.search) return reply({ok:false,error:"invalid_incident_transition"},400);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  try {
    const actor = await operator(request);
    if (!actor) throw new Refusal(403,"incident_transition_permission_required");
    const parsed = incidentTransitionRequest.safeParse(await readBoundedRequestJson(request,signal,4096).catch(() => null));
    if (!parsed.success) throw new Refusal(400,"invalid_incident_transition");
    const command = parsed.data;
    const {incidentId, releaseId, attemptId, action, previousStatus, expectedRevision} = command;
    const {organizationId, userId} = actor;
    if (command.workspaceId !== organizationId || command.actorId !== userId) {
      throw new Refusal(403,"incident_transition_permission_required");
    }
    const auditId = "itx_" + createHash("sha256").update(JSON.stringify([organizationId,userId,incidentId,attemptId])).digest("hex");
    const receipt = await prisma.$transaction(async tx => {
      const [membership] = await tx.$queryRaw<Array<{role: string; acceptedAt: Date | null}>>`
        SELECT "role"::text AS "role", "acceptedAt" FROM "OrgMembership"
        WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
      if (!membership?.acceptedAt || !canChangeIncidentStatus(membership.role)) {
        throw new Refusal(403,"incident_transition_permission_required");
      }
      const fresh = await captureCurrentDesktopSessionFreshness(tx,{organizationId,actorUserId:userId,sessionId:actor.id},signal)
        .catch(() => {throw new Refusal(403,"incident_transition_permission_required");});
      const [incident] = await tx.$queryRaw<Array<{status: string; updatedAt: Date}>>`
        SELECT "status", "updatedAt" FROM "DeploymentIncident"
        WHERE "id" = ${incidentId} AND "organizationId" = ${organizationId} AND "releaseId" = ${releaseId} FOR UPDATE`;
      if (!incident) throw new Refusal(404,"incident_transition_source_unavailable");
      fresh();
      const existing = await tx.auditEvent.findFirst({where:{
        id:auditId, organizationId, subjectKind:"release", subjectId:incidentId, actorUserId:userId, correlationId:attemptId, outcome:"ok",
      }});
      if (existing) {
        const saved = incidentTransitionReceipt.safeParse(existing.detailJson);
        if (!saved.success || !matchesIncidentTransition(saved.data,command) || existing.kind !== `deployment_incident.${action}`) {
          throw new Refusal(409,"incident_transition_attempt_conflict");
        }
        fresh();
        return saved.data;
      }
      if (incident.status !== previousStatus || incident.updatedAt.toISOString() !== expectedRevision) {
        throw new Refusal(409,"incident_transition_changed");
      }
      const [release] = await tx.$queryRaw<Array<{id: string}>>`
        SELECT "id" FROM "Release" WHERE "id" = ${releaseId} AND "organizationId" = ${organizationId} FOR SHARE`;
      if (!release) throw new Refusal(404,"incident_transition_source_unavailable");

      const now = new Date();
      const revision = new Date(Math.max(now.getTime(),incident.updatedAt.getTime()+1));
      const plan = planTransition(previousStatus,action,{actorUserId:userId,now});
      if (!plan.ok) throw new Refusal(422,"incident_transition_illegal");
      const data = incidentTransitionReceipt.parse({...command,status:plan.next,revision:revision.toISOString()});
      fresh();
      const changed = await tx.deploymentIncident.updateMany({
        where:{id:incidentId,organizationId,releaseId,status:previousStatus,updatedAt:incident.updatedAt},
        data:{...plan.fields,status:plan.next,updatedAt:revision},
      });
      if (changed.count !== 1) throw new Refusal(409,"incident_transition_changed");
      await tx.auditEvent.create({data:{
        id:auditId,organizationId,actorUserId:userId,kind:`deployment_incident.${action}`,subjectKind:"release",subjectId:incidentId,
        correlationId:attemptId,summary:`Incident ${previousStatus} → ${plan.next}`,detailJson:data,
      }});
      fresh();
      return data;
    });
    const current = await operator(request);
    if (current?.id !== actor.id || current.userId !== userId || current.organizationId !== organizationId) {
      throw new Refusal(403,"incident_transition_permission_required");
    }
    return reply({ok:true,data:receipt});
  } catch (error) {
    return error instanceof Refusal ? reply({ok:false,error:error.message},error.status)
      : reply({ok:false,error:"incident_transition_unavailable"},503);
  }
}
