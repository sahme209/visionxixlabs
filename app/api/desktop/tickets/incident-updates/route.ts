import {createHash} from "node:crypto";
import {NextResponse, type NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {readBoundedRequestJson} from "@/lib/api/readBoundedRequestJson";
import {captureCurrentDesktopSessionFreshness} from "@/lib/desktop/currentSessionFreshness";
import {resolveRequestDesktopSession, type DesktopRequestPrincipal} from "@/lib/desktop/resolveRequestDesktopSession";
import {canReportDeploymentIncident} from "@/lib/tauri/incidentReportContract";
import {incidentEvidenceReference} from "@/lib/releaseops/incidentEvidencePack";
import {incidentUpdateEvidence, incidentUpdateLimit, incidentUpdateList, incidentUpdateReceipt, incidentUpdateRequest} from "@/lib/tauri/incidentUpdateContract";
import {ticketLinkId} from "@/lib/tauri/ticketDirectoryContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const policy = {
  route: "/api/desktop/tickets/incident-updates", requiredScope: "pipeline:read",
  requiredCapability: "workspace:read", requireWorkspaceMembership: true, allowApiKey: false, recordHeartbeat: false,
} as const;

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
}

async function reader(request: NextRequest) {
  const actor = await resolveRequestDesktopSession(request, policy);
  if (actor?.credentialKind === "desktop_session" && actor.capabilities.includes("workspace:read")) return actor;
}

function sameActor(current: DesktopRequestPrincipal | undefined, actor: DesktopRequestPrincipal) {
  return current?.id === actor.id && current.userId === actor.userId && current.organizationId === actor.organizationId;
}

function noteView(row: {id: string; body: string; createdAt: Date; authorUserId: string; evidenceJson?: unknown},
  actor: DesktopRequestPrincipal, includeEvidence: boolean) {
  const evidence = includeEvidence ? incidentUpdateEvidence.safeParse(row.evidenceJson) : undefined;
  return {
    id: row.id, body: row.body, recordedAt: row.createdAt.toISOString(), authoredByYou: row.authorUserId === actor.userId,
    ...(evidence?.success && {evidence: evidence.data}),
  };
}

const releaseFields = {id: true, organizationId: true, releaseTag: true, commitSha: true} as const;
const packFields = {organizationId: true, releaseId: true, contentHash: true, contentJson: true} as const;

async function attachableEvidence(organizationId: string, releaseId: string) {
  const [release, pack] = await Promise.all([
    prisma.release.findFirst({where: {id: releaseId, organizationId}, select: releaseFields}),
    prisma.releaseEvidencePack.findFirst({where: {releaseId, organizationId}, select: packFields}),
  ]);
  return release ? incidentEvidenceReference(pack, release) : null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const incidentId = query.get("incidentId");
  const releaseId = query.get("releaseId");
  const includeEvidence = query.get("includeEvidence") === "1";
  if (query.size !== (includeEvidence ? 3 : 2) || !ticketLinkId.safeParse(incidentId).success || !ticketLinkId.safeParse(releaseId).success || !incidentId || !releaseId) {
    return reply({ok: false, error: "invalid_incident_update"}, 400);
  }
  try {
    const actor = await reader(request);
    if (!actor) return reply({ok: false, error: "incident_update_permission_required"}, 403);
    const scope = {organizationId: actor.organizationId, incidentId, releaseId};
    const findIncident = () => prisma.deploymentIncident.findFirst({
      where: {id: incidentId, organizationId: scope.organizationId, releaseId}, select: {id: true},
    });
    if (!await findIncident()) return reply({ok: false, error: "incident_update_source_unavailable"}, 404);
    const [rows, candidate] = await Promise.all([prisma.deploymentIncidentUpdate.findMany({
      where: scope, orderBy: [{createdAt: "desc"}, {id: "desc"}], take: incidentUpdateLimit + 1,
      select: {id: true, body: true, createdAt: true, authorUserId: true, ...(includeEvidence && {evidenceJson: true})},
    }), includeEvidence && canReportDeploymentIncident(actor.role)
      ? attachableEvidence(scope.organizationId, releaseId).catch(() => null) : null]);
    const [current, incident] = await Promise.all([reader(request), findIncident()]);
    if (!current || !sameActor(current, actor)) return reply({ok: false, error: "incident_update_permission_required"}, 403);
    if (!incident) return reply({ok: false, error: "incident_update_source_unavailable"}, 404);
    const canWrite = canReportDeploymentIncident(current.role);
    const data = incidentUpdateList.parse({
      workspaceId: scope.organizationId, actorId: actor.userId, incidentId, releaseId,
      canWrite, ...(includeEvidence && {attachableEvidence: canWrite ? candidate : null}), limited: rows.length > incidentUpdateLimit,
      notes: rows.slice(0, incidentUpdateLimit).map(row => noteView(row, actor, includeEvidence)),
    });
    return reply({ok: true, data});
  } catch {
    return reply({ok: false, error: "incident_updates_unavailable"}, 503);
  }
}

class UpdateRefusal extends Error {
  constructor(readonly status: number, code: string) { super(code); }
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.search) return reply({ok: false, error: "invalid_incident_update"}, 400);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  try {
    const actor = await reader(request);
    if (!actor || !canReportDeploymentIncident(actor.role)) return reply({ok: false, error: "incident_update_permission_required"}, 403);
    const parsed = incidentUpdateRequest.safeParse(await readBoundedRequestJson(request, signal, 8192).catch(() => null));
    if (!parsed.success) return reply({ok: false, error: "invalid_incident_update"}, 400);
    const {incidentId, releaseId, attemptId, body, evidence} = parsed.data;
    const {organizationId, userId} = actor;
    if (parsed.data.workspaceId !== organizationId || parsed.data.actorId !== userId) {
      return reply({ok: false, error: "incident_update_permission_required"}, 403);
    }
    const id = "inu_" + createHash("sha256").update(JSON.stringify([organizationId, userId, incidentId, attemptId])).digest("hex");
    const scope = {organizationId, incidentId, releaseId};
    const {row, inserted} = await prisma.$transaction(async tx => {
      const [membership] = await tx.$queryRaw<Array<{role: string; acceptedAt: Date | null}>>`
        SELECT "role"::text AS "role", "acceptedAt" FROM "OrgMembership"
        WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
      if (!membership?.acceptedAt || !canReportDeploymentIncident(membership.role)) {
        throw new UpdateRefusal(403, "incident_update_permission_required");
      }
      const fresh = await captureCurrentDesktopSessionFreshness(tx, {organizationId, actorUserId: userId, sessionId: actor.id}, signal)
        .catch(() => { throw new UpdateRefusal(403, "incident_update_permission_required"); });
      const [incident] = await tx.$queryRaw<Array<{id: string}>>`
        SELECT "id" FROM "DeploymentIncident"
        WHERE "id" = ${incidentId} AND "organizationId" = ${organizationId} AND "releaseId" = ${releaseId} FOR SHARE`;
      if (!incident) throw new UpdateRefusal(404, "incident_update_source_unavailable");
      fresh();

      const findUpdate = () => tx.deploymentIncidentUpdate.findFirst({where: {id, ...scope, authorUserId: userId}});
      const matchesEvidence = (stored: {commit: string; digest: string}) =>
        stored.commit === evidence?.commit && stored.digest === evidence?.digest;
      function confirmAttempt(row: Awaited<ReturnType<typeof findUpdate>>) {
        const stored = incidentUpdateEvidence.safeParse(row?.evidenceJson);
        if (!row || row.body !== body || (evidence ? !stored.success || !matchesEvidence(stored.data) : row.evidenceJson != null)) {
          throw new UpdateRefusal(409, "incident_update_attempt_conflict");
        }
        fresh();
        return row;
      }
      const existing = await findUpdate();
      if (existing) return {row: confirmAttempt(existing), inserted: false};

      let snapshot;
      if (evidence) {
        const [release] = await tx.$queryRaw<Array<Parameters<typeof incidentEvidenceReference>[1]>>`
          SELECT "id", "organizationId", "releaseTag", "commitSha" FROM "Release"
          WHERE "id" = ${releaseId} AND "organizationId" = ${organizationId} FOR SHARE`;
        const [pack] = await tx.$queryRaw<Array<NonNullable<Parameters<typeof incidentEvidenceReference>[0]>>>`
          SELECT "organizationId", "releaseId", "contentHash", "contentJson" FROM "ReleaseEvidencePack"
          WHERE "releaseId" = ${releaseId} AND "organizationId" = ${organizationId} FOR SHARE`;
        snapshot = release ? incidentEvidenceReference(pack ?? null, release) : null;
        if (!snapshot || !matchesEvidence(snapshot)) {
          const replay = await findUpdate();
          if (replay) return {row: confirmAttempt(replay), inserted: false};
          throw new UpdateRefusal(409, "incident_update_evidence_changed");
        }
      }

      const {count} = await tx.deploymentIncidentUpdate.createMany({
        data: {id, ...scope, authorUserId: userId, body, createdAt: new Date(), ...(snapshot && {evidenceJson: snapshot})},
        skipDuplicates: true,
      });
      const row = confirmAttempt(await findUpdate());
      if (count) await tx.auditEvent.create({data: {
        organizationId, actorUserId: userId, kind: "deployment_incident.update_added", subjectKind: "release", subjectId: incidentId,
        correlationId: attemptId, summary: "Investigation update added in Studio", detailJson: {updateId: id, releaseId},
      }});
      fresh();
      return {row, inserted: count === 1};
    });
    if (!sameActor(await reader(request), actor)) return reply({ok: false, error: "incident_update_permission_required"}, 403);
    const data = incidentUpdateReceipt.parse({
      workspaceId: organizationId, actorId: userId, incidentId, releaseId, attemptId, note: noteView(row, actor, !!evidence),
    });
    return reply({ok: true, data}, inserted ? 201 : 200);
  } catch (error) {
    if (error instanceof UpdateRefusal) return reply({ok: false, error: error.message}, error.status);
    return reply({ok: false, error: "incident_updates_unavailable"}, 503);
  }
}
