import {createHash} from "node:crypto";
import {NextResponse, type NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {readBoundedRequestJson} from "@/lib/api/readBoundedRequestJson";
import {captureCurrentDesktopSessionFreshness} from "@/lib/desktop/currentSessionFreshness";
import {resolveRequestDesktopSession, type DesktopRequestPrincipal} from "@/lib/desktop/resolveRequestDesktopSession";
import {readIncidentSourceEvidence} from "@/lib/releaseops/incidentSourceEvidence";
import {canChangeIncidentStatus} from "@/lib/tauri/incidentTransitionContract";
import {incidentCollectionReceipt, incidentCollectionRequest, incidentCollectionStatus, sameCollection} from "@/lib/tauri/incidentCollectionContract";
import {ticketLinkId} from "@/lib/tauri/ticketDirectoryContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const kind = "deployment_incident.evidence_collected";
const policy = {
  route:"/api/desktop/tickets/incident-collection",requiredScope:"pipeline:read",requiredCapability:"github:read",
  requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,
} as const;
function reply(body:unknown,status=200) {
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
async function reader(request:NextRequest) {
  const actor = await resolveRequestDesktopSession(request,policy);
  if (actor?.credentialKind === "desktop_session" && actor.capabilities.includes("github:read") && actor.capabilities.includes("workspace:read")) return actor;
}
function sameActor(current:DesktopRequestPrincipal|undefined, original:DesktopRequestPrincipal) {
  return current?.id === original.id && current.userId === original.userId && current.organizationId === original.organizationId;
}
class Refusal extends Error {
  constructor(readonly status:number, message:string) { super(message); }
}
function failed(error:unknown) {
  return error instanceof Refusal ? reply({ok:false,error:error.message},error.status)
    : reply({ok:false,error:"incident_collection_unavailable"},503);
}
const auditScope = (organizationId:string, incidentId:string) =>
  ({organizationId,kind,subjectKind:"release",subjectId:incidentId,outcome:"ok"});
const collectionAuditId = (organizationId:string, userId:string, incidentId:string, attemptId:string) =>
  "iec_" + createHash("sha256").update(JSON.stringify([organizationId,userId,incidentId,attemptId])).digest("hex");

export async function GET(request:NextRequest) {
  const query = request.nextUrl.searchParams;
  const input = ticketLinkId.safeParse(query.get("incidentId"));
  const attempt = query.has("attemptId") ? incidentCollectionRequest.shape.attemptId.safeParse(query.get("attemptId")) : undefined;
  if (query.size !== (attempt ? 2 : 1) || !input.success || attempt?.success === false) return reply({ok:false,error:"invalid_incident_collection"},400);
  const incidentId = input.data;
  try {
    const actor = await reader(request);
    if (!actor) throw new Refusal(403,"incident_collection_permission_required");
    const {organizationId,userId} = actor;
    const incident = await prisma.deploymentIncident.findFirst({
      where:{id:incidentId,organizationId}, select:{releaseId:true,updatedAt:true},
    });
    if (!incident) throw new Refusal(404,"incident_collection_source_unavailable");
    if (!sameActor(await reader(request),actor)) throw new Refusal(403,"incident_collection_permission_required");
    if (attempt?.success) {
      const attemptId = attempt.data;
      const event = await prisma.auditEvent.findFirst({
        where:{...auditScope(organizationId,incidentId),id:collectionAuditId(organizationId,userId,incidentId,attemptId),
          actorUserId:userId,correlationId:attemptId},
        select:{detailJson:true},
      });
      if (!event) return reply({ok:true,data:null});
      const receipt = incidentCollectionReceipt.safeParse(event.detailJson);
      if (!receipt.success || receipt.data.workspaceId !== organizationId || receipt.data.actorId !== userId ||
          receipt.data.incidentId !== incidentId || receipt.data.releaseId !== incident.releaseId || receipt.data.attemptId !== attemptId) {
        throw new Refusal(409,"incident_collection_attempt_conflict");
      }
      return reply({ok:true,data:receipt.data});
    }


    // All source facts and the latest receipt must describe the same database snapshot.
    const [current] = await prisma.$queryRaw<Array<{
      releaseId:string; incidentRevision:Date; releaseRevision:Date|null; commit:string|null; baselineCommit:string|null;
      detailJson:unknown; actorUserId:string|null; correlationId:string|null;
    }>>`
      SELECT i."releaseId", i."updatedAt" AS "incidentRevision", r."updatedAt" AS "releaseRevision",
        r."commitSha" AS "commit", baseline."commitSha" AS "baselineCommit",
        event."detailJson", event."actorUserId", event."correlationId"
      FROM "DeploymentIncident" i
      LEFT JOIN "Release" r ON r."id" = i."releaseId" AND r."organizationId" = i."organizationId"
      LEFT JOIN "Release" baseline ON baseline."id" = r."rollbackReferenceReleaseId"
        AND baseline."organizationId" = r."organizationId"
        AND baseline."applicationId" = r."applicationId"
        AND baseline."targetEnvironmentId" IS NOT DISTINCT FROM r."targetEnvironmentId"
        AND baseline."evidenceRepositoryId" IS NOT DISTINCT FROM r."evidenceRepositoryId"
      LEFT JOIN LATERAL (
        SELECT a."detailJson", a."actorUserId", a."correlationId"
        FROM "AuditEvent" a
        WHERE a."organizationId" = i."organizationId" AND a."kind" = ${kind} AND a."subjectKind" = 'release'
          AND a."subjectId" = i."id" AND a."outcome" = 'ok'
        ORDER BY a."createdAt" DESC, a."id" DESC
        LIMIT 1
      ) event ON true
      WHERE i."id" = ${incidentId} AND i."organizationId" = ${organizationId}`;
    if (!current || current.incidentRevision.getTime() !== incident.updatedAt.getTime() || current.releaseId !== incident.releaseId) {
      throw new Refusal(409,"incident_collection_changed");
    }
    if (!current.releaseRevision) throw new Refusal(404,"incident_collection_source_unavailable");
    const receipt = incidentCollectionReceipt.safeParse(current.detailJson);
    const incidentRevision = current.incidentRevision.toISOString();
    const recorded = receipt.success && receipt.data.workspaceId === organizationId && receipt.data.actorId === current.actorUserId &&
      receipt.data.attemptId === current.correlationId && receipt.data.incidentId === incidentId && receipt.data.releaseId === current.releaseId &&
      receipt.data.incidentRevision === incidentRevision && receipt.data.commit === current.commit &&
      receipt.data.releaseRevision === current.releaseRevision.toISOString() && receipt.data.baselineCommit === current.baselineCommit;
    return reply({ok:true,data:incidentCollectionStatus.parse({
      workspaceId:organizationId,actorId:userId,incidentId,releaseId:current.releaseId,
      incidentRevision,collectedAt:recorded ? receipt.data.recordedAt : null,
    })});
  } catch (error) { return failed(error); }
}

export async function POST(request:NextRequest) {
  if (request.nextUrl.search) return reply({ok:false,error:"invalid_incident_collection"},400);
  const signal = AbortSignal.any([request.signal,AbortSignal.timeout(10000)]);
  try {
    const actor = await reader(request);
    if (!actor || !canChangeIncidentStatus(actor.role)) throw new Refusal(403,"incident_collection_permission_required");
    const parsed = incidentCollectionRequest.safeParse(await readBoundedRequestJson(request,signal,4096).catch(() => null));
    if (!parsed.success) throw new Refusal(400,"invalid_incident_collection");
    const command = parsed.data;
    const {organizationId,userId} = actor;
    if (command.workspaceId !== organizationId || command.actorId !== userId) throw new Refusal(403,"incident_collection_permission_required");
    const {incidentId,releaseId,attemptId} = command;
    const id = collectionAuditId(organizationId,userId,incidentId,attemptId);
    const data = await prisma.$transaction(async tx => {
      const [membership] = await tx.$queryRaw<Array<{role:string; acceptedAt:Date|null}>>`
        SELECT "role"::text AS "role", "acceptedAt" FROM "OrgMembership"
        WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
      if (!membership?.acceptedAt || !canChangeIncidentStatus(membership.role)) throw new Refusal(403,"incident_collection_permission_required");
      const fresh = await captureCurrentDesktopSessionFreshness(tx,{organizationId,actorUserId:userId,sessionId:actor.id},signal)
        .catch(() => {throw new Refusal(403,"incident_collection_permission_required");});
      const [incident] = await tx.$queryRaw<Array<{updatedAt:Date}>>`
        SELECT "updatedAt" FROM "DeploymentIncident" WHERE "id" = ${incidentId} AND "organizationId" = ${organizationId}
        AND "releaseId" = ${releaseId} FOR UPDATE`;
      if (!incident) throw new Refusal(404,"incident_collection_source_unavailable");
      fresh();
      const saved = await tx.auditEvent.findFirst({where:{...auditScope(organizationId,incidentId),id,actorUserId:userId,correlationId:attemptId}});
      if (saved) {
        const receipt = incidentCollectionReceipt.safeParse(saved.detailJson);
        if (!receipt.success || !sameCollection(receipt.data,command)) throw new Refusal(409,"incident_collection_attempt_conflict");
        fresh();
        return receipt.data;
      }
      if (incident.updatedAt.toISOString() !== command.incidentRevision) throw new Refusal(409,"incident_collection_changed");
      const [locked] = await tx.$queryRaw<Array<{id:string}>>`
        SELECT "id" FROM "Release" WHERE "id" = ${releaseId} AND "organizationId" = ${organizationId} FOR SHARE`;
      if (!locked) throw new Refusal(404,"incident_collection_source_unavailable");
      const release = await tx.release.findFirst({where:{id:releaseId,organizationId}});
      if (!release) throw new Refusal(404,"incident_collection_source_unavailable");
      const sources = await readIncidentSourceEvidence(release,tx);
      if (sources.state !== "recorded" || sources.repository !== command.repository || sources.commit !== command.commit ||
          sources.comparison?.baselineCommit !== command.baselineCommit ||
          !sources.runs?.some(run => run.status === "completed" && run.runId === command.runId && run.observedAt === command.observedAt)) {
        throw new Refusal(409,"incident_collection_changed");
      }
      fresh();
      const receipt = incidentCollectionReceipt.parse({
        ...command,recordedAt:new Date().toISOString(),releaseRevision:release.updatedAt.toISOString(),
      });
      fresh();
      await tx.auditEvent.create({data:{
        ...auditScope(organizationId,incidentId),id,actorUserId:userId,correlationId:attemptId,
        summary:"Operator recorded collection of workflow logs and release comparison",detailJson:receipt,
      }});
      fresh();
      return receipt;
    });
    const current = await reader(request);
    if (!sameActor(current,actor) || !canChangeIncidentStatus(current?.role)) throw new Refusal(403,"incident_collection_permission_required");
    return reply({ok:true,data});
  } catch (error) { return failed(error); }
}
