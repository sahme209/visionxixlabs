import {createHash} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {readBoundedRequestJson} from "@/lib/api/readBoundedRequestJson";
import {captureCurrentDesktopSessionFreshness} from "@/lib/desktop/currentSessionFreshness";
import {resolveRequestDesktopSession,type DesktopRequestPrincipal} from "@/lib/desktop/resolveRequestDesktopSession";
import {assignmentCandidates} from "@/lib/releaseops/incidentAssignments";
import {incidentAssignmentOptions,incidentAssignmentReceipt,incidentAssignmentRequest,matchesAssignment} from "@/lib/tauri/incidentAssignmentContract";
import {canChangeIncidentStatus} from "@/lib/tauri/incidentTransitionContract";
import {ticketLinkId} from "@/lib/tauri/ticketDirectoryContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const policy = {
  route:"/api/desktop/tickets/incident-assignment",requiredScope:"pipeline:read",requiredCapability:"workspace:read",
  requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,
} as const;
const candidateLimit = 100;
const kind = "deployment_incident.owner_changed";

function reply(body:unknown,status=200) {
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
async function operator(request:NextRequest) {
  const actor = await resolveRequestDesktopSession(request,policy);
  if (actor?.credentialKind === "desktop_session" && actor.capabilities.includes("workspace:read") && canChangeIncidentStatus(actor.role)) return actor;
}
function sameActor(current:DesktopRequestPrincipal|undefined, actor:DesktopRequestPrincipal) {
  return current?.id === actor.id && current.userId === actor.userId && current.organizationId === actor.organizationId;
}
class Refusal extends Error {
  constructor(readonly status:number, message:string) { super(message); }
}
function failed(error:unknown) {
  return error instanceof Refusal ? reply({ok:false,error:error.message},error.status)
    : reply({ok:false,error:"incident_assignment_unavailable"},503);
}

export async function GET(request:NextRequest) {
  const query = request.nextUrl.searchParams;
  const input = ticketLinkId.safeParse(query.get("incidentId"));
  if (query.size !== 1 || !input.success) return reply({ok:false,error:"invalid_incident_assignment"},400);
  const incidentId = input.data;
  try {
    const actor = await operator(request);
    if (!actor) throw new Refusal(403,"incident_assignment_permission_required");
    const {organizationId,userId} = actor;
    const readIncident = () => prisma.deploymentIncident.findFirst({
      where:{id:incidentId,organizationId},select:{updatedAt:true,releaseId:true},
    });
    const incident = await readIncident();
    if (!incident) throw new Refusal(404,"incident_assignment_source_unavailable");
    const [assignment,candidates] = await Promise.all([
      prisma.deploymentIncidentAssignment.findUnique({where:{incidentId}}),
      assignmentCandidates(organizationId,undefined,candidateLimit+1),
    ]);
    const [current,currentActor] = await Promise.all([readIncident(),operator(request)]);
    if (!sameActor(currentActor,actor)) throw new Refusal(403,"incident_assignment_permission_required");
    if (!current || current.releaseId !== incident.releaseId || current.updatedAt.getTime() !== incident.updatedAt.getTime() ||
      (assignment && assignment.organizationId !== organizationId)) throw new Refusal(409,"incident_assignment_changed");
    return reply({ok:true,data:incidentAssignmentOptions.parse({
      workspaceId:organizationId,actorId:userId,incidentId,releaseId:incident.releaseId,incidentRevision:incident.updatedAt.toISOString(),
      assignmentRevision:assignment?.updatedAt.toISOString() ?? null,candidates:candidates.slice(0,candidateLimit),limited:candidates.length>candidateLimit,
    })});
  } catch (error) { return failed(error); }
}

export async function POST(request:NextRequest) {
  if (request.nextUrl.search) return reply({ok:false,error:"invalid_incident_assignment"},400);
  const signal = AbortSignal.any([request.signal,AbortSignal.timeout(10000)]);
  try {
    const actor = await operator(request);
    if (!actor) throw new Refusal(403,"incident_assignment_permission_required");
    const parsed = incidentAssignmentRequest.safeParse(await readBoundedRequestJson(request,signal,4096).catch(() => null));
    if (!parsed.success) throw new Refusal(400,"invalid_incident_assignment");
    const command = parsed.data;
    const {organizationId,userId} = actor;
    if (command.workspaceId !== organizationId || command.actorId !== userId) throw new Refusal(403,"incident_assignment_permission_required");
    const {incidentId,releaseId,attemptId,ownerUserId} = command;
    const auditId = "iax_" + createHash("sha256").update(JSON.stringify([organizationId,userId,incidentId,attemptId])).digest("hex");
    const audit = {id:auditId,organizationId,kind,subjectKind:"release",subjectId:incidentId,actorUserId:userId,correlationId:attemptId,outcome:"ok"};
    const data = await prisma.$transaction(async tx => {
      const members = await tx.$queryRaw<Array<{userId:string;role:string;acceptedAt:Date|null}>>`
        SELECT "userId","role"::text AS "role","acceptedAt" FROM "OrgMembership" WHERE "organizationId" = ${organizationId}
        AND ("userId" = ${userId} OR "userId" = ${ownerUserId}) ORDER BY "userId" FOR SHARE`;
      const eligible = (id:string) => members.some(member => member.userId === id && member.acceptedAt && canChangeIncidentStatus(member.role));
      if (!eligible(userId)) throw new Refusal(403,"incident_assignment_permission_required");
      const fresh = await captureCurrentDesktopSessionFreshness(tx,{organizationId,actorUserId:userId,sessionId:actor.id},signal)
        .catch(() => {throw new Refusal(403,"incident_assignment_permission_required");});
      const [incident] = await tx.$queryRaw<Array<{updatedAt:Date}>>`
        SELECT "updatedAt" FROM "DeploymentIncident" WHERE "id" = ${incidentId} AND "organizationId" = ${organizationId}
        AND "releaseId" = ${releaseId} FOR UPDATE`;
      if (!incident) throw new Refusal(404,"incident_assignment_source_unavailable");
      fresh();
      const saved = await tx.auditEvent.findFirst({where:audit,select:{detailJson:true}});
      if (saved) {
        const receipt = incidentAssignmentReceipt.safeParse(saved.detailJson);
        if (!receipt.success || !matchesAssignment(receipt.data,command)) throw new Refusal(409,"incident_assignment_attempt_conflict");
        fresh();
        return receipt.data;
      }
      if (incident.updatedAt.toISOString() !== command.incidentRevision) throw new Refusal(409,"incident_assignment_changed");
      if (ownerUserId && !eligible(ownerUserId)) throw new Refusal(409,"incident_assignment_owner_unavailable");
      const [release] = await tx.$queryRaw<Array<{id:string}>>`
        SELECT "id" FROM "Release" WHERE "id" = ${releaseId} AND "organizationId" = ${organizationId} FOR SHARE`;
      if (!release) throw new Refusal(404,"incident_assignment_source_unavailable");
      const previous = await tx.deploymentIncidentAssignment.findUnique({where:{incidentId}});
      if ((previous && previous.organizationId !== organizationId) ||
          (previous?.updatedAt.toISOString() ?? null) !== command.expectedAssignmentRevision) {
        throw new Refusal(409,"incident_assignment_changed");
      }
      const revision = new Date(Math.max(Date.now(),(previous?.updatedAt.getTime() ?? 0)+1));
      const receipt = incidentAssignmentReceipt.parse({...command,assignmentRevision:revision.toISOString()});
      fresh();
      await tx.deploymentIncidentAssignment.upsert({
        where:{incidentId},create:{incidentId,organizationId,ownerUserId,updatedAt:revision},update:{ownerUserId,updatedAt:revision},
      });
      await tx.auditEvent.create({data:{...audit,summary:ownerUserId ? "Incident owner assigned in Studio" : "Incident owner cleared in Studio",
        detailJson:receipt}});
      fresh();
      return receipt;
    });
    if (!sameActor(await operator(request),actor)) throw new Refusal(403,"incident_assignment_permission_required");
    return reply({ok:true,data});
  } catch (error) { return failed(error); }
}
