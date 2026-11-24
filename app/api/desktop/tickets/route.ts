import {incidentResponseTargets} from "@/lib/releaseops/incidentResponseTargets";
import {incidentOwners} from "@/lib/releaseops/incidentAssignments";
import {NextResponse, type NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {projectIncidentRemediationReview} from "@/lib/releaseops/incidentRemediationReview";
import {incidentRemediationReviewSchema} from "@/lib/tauri/incidentRemediationReviewContract";
import {readIncidentSourceEvidence} from "@/lib/releaseops/incidentSourceEvidence";
import {summarizeIncidentEvidence} from "@/lib/releaseops/incidentEvidencePack";
import {resolveRequestDesktopSession} from "@/lib/desktop/resolveRequestDesktopSession";
import {buildChangeTicketListResponse, type ChangeTicketListRepo} from "@/lib/releaseops/changeTicketListResponder";
import {buildIncidentListResponse, type DeploymentIncidentListRepo} from "@/lib/releaseops/deploymentIncidentResponder";
import {incidentActivityAction, incidentActivityLimit, incidentActivitySchema, incidentReleaseSchema, incidentReleaseShape, incidentTriageSchema, ticketDirectoryBodyLimit, ticketDirectoryLimit, ticketDirectorySchema, ticketLinkId, ticketReleaseLinkLimit, ticketReleaseLinksSchema, type IncidentRecovery, type IncidentReleaseContext, type TicketDirectory} from "@/lib/tauri/ticketDirectoryContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const policy = {
  route: "GET /api/desktop/tickets",
  requiredScope: "pipeline:read",
  requiredCapability: "workspace:read",
  // The explicit capability still requires an accepted role. Skip the resolver's
  // personal workspace repair and heartbeat writes for this read-only surface.
  requireWorkspaceMembership: false,
  allowApiKey: false,
  recordHeartbeat: false,
} as const;

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
}
function sourceState(body: {ok: boolean; error?: string}): TicketDirectory["sources"]["changes"]["state"] {
  return body.ok ? "available" : body.error === "migration_pending" ? "migration_pending" : "unavailable";
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const requested = query.get("changeTicketId");
  const incidentId = query.get("deploymentIncidentId");
  const activityId = query.get("incidentActivityId");
  const triageId = query.get("incidentTriageId");
  const remediationId = query.get("incidentRemediationId");
  const sourcesRequested = query.size === 2 && Boolean(incidentId) && query.get("includeIncidentSources") === "1";
  const evidenceRequested = sourcesRequested ||
    (query.size === 2 && !requested && Boolean(incidentId) && query.get("includeReleaseEvidence") === "1");
  const recoveryRequested = query.size === 2 && !requested && Boolean(incidentId) && query.get("includeReleaseRecovery") === "1";
  if (request.nextUrl.search && ((!evidenceRequested && !recoveryRequested && query.size !== 1) || !ticketLinkId.safeParse(requested ?? incidentId ?? activityId ?? triageId ?? remediationId).success)) {
    return reply({ok: false, error: "invalid_ticket_directory_request"}, 400);
  }
  try {
    const resolve = async () => {
      request.signal.throwIfAborted();
      const principal = await resolveRequestDesktopSession(request, policy);
      return principal?.credentialKind === "desktop_session" && principal.capabilities.includes("workspace:read")
        ? principal : undefined;
    };
    const actor = await resolve();
    if (!actor) return reply({ok: false, error: "desktop_session_required"}, 401);
    const organizationId = actor.organizationId;
    const stillOwns = async (requireGitHub = false) => {
      const current = await resolve();
      request.signal.throwIfAborted();
      return current?.id === actor.id && current.userId === actor.userId && current.organizationId === organizationId &&
        (!requireGitHub || current.capabilities.includes("github:read"));
    };

    const inspectionId = activityId ?? triageId ?? remediationId;
    if (inspectionId) {
      const readIncident = () => prisma.deploymentIncident.findFirst({
        where: {id: inspectionId, organizationId},
        select: {id: true, organizationId: true, releaseId: true, updatedAt: true, reportedAt:true},
      });
      const incident = await readIncident();
      if (!incident || incident.id !== inspectionId || incident.organizationId !== organizationId ||
        !ticketLinkId.safeParse(incident.releaseId).success) {
        return reply({ok: false, error: "ticket_not_found"}, 404);
      }
      const verifyInspection = async () => {
        const current = await readIncident();
        if (!await stillOwns()) return reply({ok: false, error: "desktop_session_changed"}, 403);
        if (!current || current.id !== inspectionId || current.organizationId !== organizationId ||
          current.releaseId !== incident.releaseId || current.updatedAt.getTime() !== incident.updatedAt.getTime()) {
          return reply({ok: false, error: remediationId ? "incident_remediation_changed" :
            triageId ? "incident_triage_changed" : "incident_activity_changed"}, 409);
        }
      };
      if (remediationId) {
        const readRelease = () => prisma.release.findFirst({
          where: {id: incident.releaseId, organizationId},
          select: {id:true,organizationId:true,applicationId:true,targetEnvironmentId:true,commitSha:true,releaseTag:true,updatedAt:true},
        });
        const [release, proposal] = await Promise.all([
          readRelease(),
          prisma.remediationProposal.findFirst({
            where: {incidentId:inspectionId,organizationId},
            orderBy: [{generatedAt:"desc"},{id:"desc"}],
            select: {id:true,organizationId:true,incidentId:true,title:true,inputsJson:true,generatedAt:true,
              operatorDecision:true,decidedAt:true,decidedByUserId:true},
          }),
        ]);
        const currentRelease = await readRelease();
        const invalidated = await verifyInspection();
        if (invalidated) return invalidated;
        if (!release || !currentRelease || currentRelease.id !== incident.releaseId || currentRelease.organizationId !== organizationId ||
            currentRelease.updatedAt.getTime() !== release.updatedAt.getTime()) {
          return reply({ok:false,error:"incident_remediation_changed"},409);
        }
        const data = incidentRemediationReviewSchema.parse({
          workspaceId:organizationId,actorId:actor.userId,incidentId:inspectionId,releaseId:incident.releaseId,
          incidentRevision:incident.updatedAt.toISOString(),proposal:projectIncidentRemediationReview(incident,release,proposal),
        });
        return reply({ok:true,data});
      }
      if (triageId) {
        const row = await prisma.incidentTriage.findFirst({
          where: {incidentId: inspectionId, organizationId},
          orderBy: [{generatedAt: "desc"}, {id: "desc"}],
          select: {id: true, incidentId: true, organizationId: true, priority: true, suggestedOwnerTeam: true,
            rationale: true, operatorDecision: true, decidedAt: true, overridePriority: true, generatedAt: true},
        });
        const invalidated = await verifyInspection();
        if (invalidated) return invalidated;
        if (row && (row.incidentId !== inspectionId || row.organizationId !== organizationId)) {
          return reply({ok: false, error: "incident_triage_unavailable"}, 503);
        }
        const data = incidentTriageSchema.parse({
          workspaceId: organizationId, actorId: actor.userId, incidentId: inspectionId, releaseId: incident.releaseId,
          recommendation: row && {
            id: row.id, priority: row.priority, suggestedTeam: row.suggestedOwnerTeam,
            rationale: row.rationale.slice(0, 1200), decision: row.operatorDecision,
            decidedAt: row.decidedAt?.toISOString() ?? null, overridePriority: row.overridePriority,
            generatedAt: row.generatedAt.toISOString(),
          },
        });
        return reply({ok: true, data});
      }
      const kinds = incidentActivityAction.options.map(action => `deployment_incident.${action}`);
      // The transition writer uses the incident ID with the historical "release" subject kind.
      const scope = {organizationId, subjectKind: "release", subjectId: inspectionId, outcome: "ok"};
      const rows = await prisma.auditEvent.findMany({
        where: {...scope, kind: {in: kinds}},
        select: {id: true, kind: true, organizationId: true, subjectKind: true, subjectId: true, outcome: true, createdAt: true},
        orderBy: [{createdAt: "desc"}, {id: "desc"}],
        take: incidentActivityLimit + 1,
      });
      const invalidated = await verifyInspection();
      if (invalidated) return invalidated;
      if (rows.length > incidentActivityLimit + 1 || rows.some(row => row.organizationId !== organizationId ||
        row.subjectKind !== scope.subjectKind || row.subjectId !== inspectionId || row.outcome !== scope.outcome ||
        !kinds.includes(row.kind))) {
        return reply({ok: false, error: "incident_activity_unavailable"}, 503);
      }
      const data = incidentActivitySchema.parse({
        workspaceId: organizationId, actorId: actor.userId, incidentId: inspectionId, releaseId: incident.releaseId,
        limited: rows.length > incidentActivityLimit,
        events: rows.slice(0, incidentActivityLimit).map(row => ({
          id: row.id, action: row.kind.slice("deployment_incident.".length), recordedAt: row.createdAt.toISOString(),
        })),
      });
      return reply({ok: true, data});
    }

    if (incidentId) {
      const readIncident = () => prisma.deploymentIncident.findFirst({
        where: {id: incidentId, organizationId},
        select: {id: true, organizationId: true, releaseId: true, status: true},
      });
      const incident = await readIncident();
      if (!incident || incident.id !== incidentId || incident.organizationId !== organizationId
        || !ticketLinkId.safeParse(incident.releaseId).success) return reply({ok: false, error: "ticket_not_found"}, 404);
      const readRelease = () => prisma.release.findFirst({
        where: {id: incident.releaseId, organizationId},
        select: {id: true, organizationId: true, releaseTag: true, commitSha: true, status: true,
          applicationId: true, targetEnvironmentId: true, rollbackReferenceReleaseId: true, evidenceRepositoryId: true},
      });
      const release = await readRelease();
      const validRelease = release && release.id === incident.releaseId && release.organizationId === organizationId ? release : null;
      const canReadSources = sourcesRequested && actor.capabilities.includes("github:read");
      const [evidence, recovery, sources] = await Promise.all([
        evidenceRequested && validRelease ? prisma.releaseEvidencePack.findFirst({
          where: {releaseId: validRelease.id, organizationId},
          select: {releaseId: true, organizationId: true, contentHash: true, contentJson: true},
        }).then(row => summarizeIncidentEvidence(row, validRelease)).catch(() => ({state: "unavailable"} as const)) : undefined,
        recoveryRequested && validRelease ? readIncidentRecovery(validRelease) : undefined,
        canReadSources && validRelease
          ? readIncidentSourceEvidence(validRelease).catch(() => ({state:"unavailable"} as const)) : undefined,
      ]);
      const [current, latestRelease] = await Promise.all([readIncident(), (evidenceRequested || recoveryRequested) && validRelease ? readRelease() : validRelease]);
      if (!await stillOwns(canReadSources)) return reply({ok: false, error: "desktop_session_changed"}, 403);
      if (!validRelease || !latestRelease || latestRelease.id !== validRelease.id || latestRelease.organizationId !== organizationId ||
        latestRelease.releaseTag !== validRelease.releaseTag || latestRelease.commitSha !== validRelease.commitSha || latestRelease.status !== validRelease.status ||
        (canReadSources && latestRelease.evidenceRepositoryId !== validRelease.evidenceRepositoryId) ||
        ((recoveryRequested || canReadSources) && (latestRelease.rollbackReferenceReleaseId !== validRelease.rollbackReferenceReleaseId ||
          latestRelease.applicationId !== validRelease.applicationId || latestRelease.targetEnvironmentId !== validRelease.targetEnvironmentId)) ||
        !current || current.id !== incidentId || current.organizationId !== organizationId ||
        current.releaseId !== incident.releaseId || current.status !== incident.status) {
        return reply({ok: false, error: "incident_release_unavailable"}, 409);
      }
      const data = incidentReleaseShape.shape.release;
      const commit = data.shape.commit.safeParse(validRelease.commitSha);
      const status = data.shape.status.safeParse(validRelease.status);
      const incidentStatus = incidentReleaseShape.shape.incidentStatus.safeParse(incident.status);
      const projection = incidentReleaseSchema.parse({
        workspaceId: organizationId, actorId: actor.userId, incidentId,
        incidentStatus: incidentStatus.success ? incidentStatus.data : "unknown",
        evidence,
        recovery,
        sources,
        release: {
          id: validRelease.id, tag: validRelease.releaseTag?.slice(0, 120) ?? null,
          commit: commit.success ? commit.data : null,
          status: status.success ? status.data : "unknown",
        },
      });
      return reply({ok: true, data: projection});
    }

    if (requested) {
      const readTicket = () => prisma.changeTicket.findFirst({
        where: {id: requested, organizationId},
        select: {id: true, organizationId: true, linkedReleaseIds: true},
      });
      const ticket = await readTicket();
      if (!ticket || ticket.id !== requested || ticket.organizationId !== organizationId) {
        return reply({ok: false, error: "ticket_not_found"}, 404);
      }

      const recordedLinks = [...ticket.linkedReleaseIds];
      const ids = [...new Set(recordedLinks)].filter(value => ticketLinkId.safeParse(value).success)
        .slice(0, ticketReleaseLinkLimit);
      const rows = ids.length ? await prisma.release.findMany({
        where: {organizationId, id: {in: ids}},
        select: {id: true, organizationId: true, releaseTag: true},
      }) : [];
      const allowed = new Set(ids);
      if (rows.some(row => row.organizationId !== organizationId || !allowed.has(row.id))) {
        return reply({ok: false, error: "ticket_links_unavailable"}, 503);
      }
      const current = await readTicket();
      if (!await stillOwns()) return reply({ok: false, error: "desktop_session_changed"}, 403);
      if (!current || current.id !== requested || current.organizationId !== organizationId
        || current.linkedReleaseIds.length !== recordedLinks.length
        || current.linkedReleaseIds.some((id, index) => id !== recordedLinks[index])) {
        return reply({ok: false, error: "ticket_links_unavailable"}, 503);
      }
      const releases = rows.map(row => ({id: row.id, tag: row.releaseTag?.slice(0, 120) ?? null}));
      const data = ticketReleaseLinksSchema.parse({
        workspaceId: organizationId, actorId: actor.userId, ticketId: ticket.id,
        incomplete: releases.length !== recordedLinks.length, releases,
      });
      return reply({ok: true, data});
    }

    const change = prisma as unknown as ChangeTicketListRepo;
    const incident = prisma as unknown as DeploymentIncidentListRepo;
    const guard = <T extends {organizationId: string}>(rows: T[]) => {
      if (rows.some(row => row.organizationId !== organizationId)) throw new Error("Ticket scope mismatch");
      return rows;
    };
    const [changes, incidents] = await Promise.all([
      buildChangeTicketListResponse({changeTicket: {findMany: async args => guard(await change.changeTicket.findMany(args))}}, organizationId, {take: ticketDirectoryLimit}),
      buildIncidentListResponse({deploymentIncident: {findMany: async args => guard(await incident.deploymentIncident.findMany({...args, take: ticketDirectoryLimit}))}}, {organizationId}, {includeRevision:true}),
    ]);

    const changeRows = changes.body.ok ? changes.body.data.tickets : [];
    const incidentRows = incidents.body.ok ? incidents.body.data.incidents : [];
    const [contextByRelease, assignments, responseTargets] = await Promise.all([
      readIncidentReleaseContexts(organizationId,incidentRows.map(row => row.releaseId)),
      incidentRows.length ? incidentOwners(organizationId,incidentRows.map(row => row.id)).catch(() => undefined) : undefined,
      incidentResponseTargets(organizationId,incidentRows).catch(() => undefined),
    ]);
    if (!await stillOwns()) {
      return reply({ok: false, error: "desktop_session_changed"}, 403);
    }
    const data = ticketDirectorySchema.safeParse({
      workspaceId: organizationId, actorId: actor.userId,
      ...(assignments && {assignmentAvailable:true}),
      sources: {
        changes: {state: sourceState(changes.body), limited: changeRows.length === ticketDirectoryLimit},
        incidents: {state: sourceState(incidents.body), limited: incidentRows.length === ticketDirectoryLimit},
      },
      records: [
        ...changeRows.map(row => ({
          kind: "change", id: row.id, title: row.title.slice(0, 240), reference: row.externalKey.slice(0, 120),
          provider: row.provider, type: row.ticketType, status: row.status, priority: row.priority,
          observedAt: row.lastSyncedAtIso, relatedReleases: row.linkedReleaseCount,
        })),
        ...incidentRows.map(row => ({
          kind: "incident", id: row.id, title: row.title.slice(0, 240), releaseId: row.releaseId,
          releaseContext: contextByRelease.get(row.releaseId) ?? null,
          severity: row.severity, status: row.status, summary: row.summary?.slice(0, 600) ?? null,
          reportedAt: row.reportedAtIso, mitigatedAt: row.mitigatedAtIso, resolvedAt: row.resolvedAtIso, revision: row.revision,
          owner:assignments?.get(row.id), responseTarget:responseTargets?.get(row.id),
        })),
      ],
    });
    if (data.success) {
      const envelope = {ok: true, data: data.data};
      if (Buffer.byteLength(JSON.stringify(envelope)) <= ticketDirectoryBodyLimit) return reply(envelope);
    }
  } catch {
    // Keep datastore and session internals out of the desktop response.
  }
  return reply({ok: false, error: "ticket_directory_unavailable"}, 503);
}

async function readIncidentReleaseContexts(organizationId: string, releaseIds: string[]) {
  const contexts = new Map<string, IncidentReleaseContext>();
  const ids = [...new Set(releaseIds.filter(id => ticketLinkId.safeParse(id).success))];
  if (!ids.length) return contexts;

  const releases = await prisma.release.findMany({
    where: {organizationId, id: {in: ids}},
    select: {id: true, organizationId: true, applicationId: true, targetEnvironmentId: true},
  }).catch(() => []);
  const scoped = releases.filter(row => row.organizationId === organizationId && ids.includes(row.id));
  const applications = [...new Set(scoped.map(row => row.applicationId))];
  const environments = [...new Set(scoped.flatMap(row => row.targetEnvironmentId ?? []))];

  const [appRows, envRows] = await Promise.all([
    applications.length ? prisma.application.findMany({
      where: {organizationId, id: {in: applications}}, select: {id: true, organizationId: true, name: true},
    }).catch(() => []) : [],
    environments.length ? prisma.environment.findMany({
      where: {organizationId, id: {in: environments}}, select: {id: true, organizationId: true, name: true},
    }).catch(() => []) : [],
  ]);
  const labels = (rows: typeof appRows, permitted: string[]) => new Map(rows
    .filter(row => row.organizationId === organizationId && permitted.includes(row.id))
    .map(row => [row.id, row.name.trim().slice(0, 120)]));
  const appLabels = labels(appRows, applications);
  const envLabels = labels(envRows, environments);
  for (const release of scoped) {
    contexts.set(release.id, {
      application: appLabels.get(release.applicationId) || null,
      environment: release.targetEnvironmentId ? envLabels.get(release.targetEnvironmentId) || null : null,
    });
  }
  return contexts;
}

async function readIncidentRecovery(source: {
  id: string;
  organizationId: string;
  applicationId: string;
  targetEnvironmentId: string | null;
  rollbackReferenceReleaseId: string | null;
}): Promise<IncidentRecovery> {
  const reference = source.rollbackReferenceReleaseId;
  if (reference === null) return {state: "missing"};
  if (!ticketLinkId.safeParse(reference).success || reference === source.id || !source.applicationId || !source.targetEnvironmentId) return {state: "unavailable"};
  const target = await prisma.release.findFirst({
    where: {id: reference, organizationId: source.organizationId, applicationId: source.applicationId,
      targetEnvironmentId: source.targetEnvironmentId},
    select: {id: true, organizationId: true, applicationId: true, targetEnvironmentId: true, releaseTag: true, commitSha: true},
  }).catch(() => null);
  if (!target || target.id !== reference || target.organizationId !== source.organizationId ||
    target.applicationId !== source.applicationId || target.targetEnvironmentId !== source.targetEnvironmentId) return {state: "unavailable"};
  const commit = incidentReleaseShape.shape.release.shape.commit.safeParse(target.commitSha);
  if (!commit.success || !commit.data) return {state: "unavailable"};
  return {state: "recorded", releaseId: reference, tag: target.releaseTag?.slice(0, 120) ?? null, commit: commit.data};
}
