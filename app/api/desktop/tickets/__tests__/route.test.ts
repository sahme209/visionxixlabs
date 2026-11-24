import {NextRequest} from "next/server";
import {beforeEach, expect, it, vi} from "vitest";

const ports = vi.hoisted(() => ({resolve: vi.fn(), changes: vi.fn(), incidents: vi.fn(), findTicket: vi.fn(), releases: vi.fn(), incident: vi.fn(), release: vi.fn(), evidence:vi.fn(), audit:vi.fn(), triage:vi.fn(), apps:vi.fn(), environments:vi.fn()}));
vi.mock("@/lib/db", () => ({prisma: {application:{findMany:ports.apps},environment:{findMany:ports.environments},incidentTriage:{findFirst:ports.triage},auditEvent:{findMany:ports.audit},releaseEvidencePack:{findFirst:ports.evidence},changeTicket: {findMany: ports.changes, findFirst: ports.findTicket}, release: {findMany: ports.releases, findFirst: ports.release}, deploymentIncident: {findMany: ports.incidents, findFirst: ports.incident}}}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({resolveRequestDesktopSession: ports.resolve}));
import {GET} from "../route";

const actor = {id: "fixture-session", userId: "fixture-user", organizationId: "fixture-workspace", credentialKind: "desktop_session", capabilities: ["workspace:read"]};
const time = new Date("2026-11-20T12:00:00Z");
const incident = {id: "same-id", organizationId: actor.organizationId, releaseId: "release-1", severity: "high", status: "open", title: "Fixture investigation", reportedAt: time, mitigatedAt: null, resolvedAt: null, externalUrl: "private-provider-url", summary: "Recorded summary"};
const change = {id: "same-id", organizationId: actor.organizationId, title: "Fixture rollout", provider: "jira", externalKey: "CHG-10", ticketType: "change_request", status: "pending", priority: "normal", linkedPrRecordIds: [], linkedReleaseIds: ["release-1"], openedAt: null, closedAt: null, lastSyncedAt: time, webUrl: "private-provider-url"};
const request = (suffix = "") => new NextRequest(`https://fixture.invalid/api/desktop/tickets${suffix}`, {headers: {authorization: "Bearer axm.desk.synthetic"}});

beforeEach(() => {
  vi.resetAllMocks();
  ports.resolve.mockResolvedValue(actor);
  ports.changes.mockResolvedValue([change]);
  ports.incidents.mockResolvedValue([incident]);
  ports.releases.mockResolvedValue([]);
  ports.apps.mockResolvedValue([]);
  ports.environments.mockResolvedValue([]);
});

it("reads both bounded projections scoped to the paired principal and omits provider URLs", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(ports.resolve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    requiredCapability: "workspace:read", allowApiKey: false, requireWorkspaceMembership: false, recordHeartbeat: false,
  }));
  expect(ports.resolve).toHaveBeenCalledTimes(2);
  for (const read of [ports.changes, ports.incidents]) {
    expect(read).toHaveBeenCalledWith(expect.objectContaining({where: {organizationId: actor.organizationId}, take: 80}));
  }
  const {data} = await response.json();
  expect(data.records.map((row: {kind: string}) => row.kind)).toEqual(["change", "incident"]);
  expect(data.workspaceId).toBe(actor.organizationId);
  expect(JSON.stringify(data)).not.toContain("private-provider-url");
});

it("rejects client-selected scope and denies unpaired or unprivileged access before reading records", async () => {
  expect((await GET(request("?organizationId=foreign"))).status).toBe(400);
  for (const principal of [undefined, {...actor, credentialKind: "api_key"}, {...actor, capabilities: []}]) {
    ports.resolve.mockResolvedValue(principal);
    expect((await GET(request())).status).toBe(401);
  }
  expect(ports.changes).not.toHaveBeenCalled();
  expect(ports.incidents).not.toHaveBeenCalled();
});

it("returns independent source availability without releasing a cross-workspace row", async () => {
  ports.changes.mockResolvedValue([{...change, organizationId: "foreign", title: "private foreign record"}]);
  const {data} = await (await GET(request())).json();
  expect(data.sources.changes.state).toBe("unavailable");
  expect(data.sources.incidents.state).toBe("available");
  expect(data.records).toHaveLength(1);
  expect(JSON.stringify(data)).not.toContain("private foreign record");
});

it("discards rows after authority changes between query and response", async () => {
  ports.resolve.mockResolvedValueOnce(actor).mockResolvedValueOnce({...actor, id: "replacement"});
  const response = await GET(request());
  expect(response.status).toBe(403);
  expect(JSON.stringify(await response.json())).not.toContain("Fixture investigation");
});

it("resolves only saved release records in the ticket's workspace and reports incomplete links", async () => {
  ports.findTicket.mockResolvedValue({...change, linkedReleaseIds: ["release-1", "removed-release", "bad/unusable"]});
  ports.releases.mockResolvedValue([{id: "release-1", organizationId: actor.organizationId, releaseTag: "v2.14.0", privateNote: "hidden"}]);
  const response = await GET(request("?changeTicketId=same-id"));
  expect(response.status).toBe(200);
  expect(ports.findTicket).toHaveBeenCalledWith(expect.objectContaining({where: {id: "same-id", organizationId: actor.organizationId}}));
  expect(ports.releases).toHaveBeenCalledWith(expect.objectContaining({
    where: {organizationId: actor.organizationId, id: {in: ["release-1", "removed-release"]}},
  }));
  expect(await response.json()).toEqual({ok: true, data: {
    workspaceId: actor.organizationId, actorId: actor.userId, ticketId: "same-id",
    incomplete: true, releases: [{id: "release-1", tag: "v2.14.0"}],
  }});
});

it("withholds linked release details after workspace authority changes", async () => {
  ports.findTicket.mockResolvedValue(change);
  ports.releases.mockResolvedValue([{id: "release-1", organizationId: actor.organizationId, releaseTag: "v2.14.0"}]);
  ports.resolve.mockResolvedValueOnce(actor).mockResolvedValueOnce({...actor, organizationId: "replacement"});
  expect((await GET(request("?changeTicketId=same-id"))).status).toBe(403);
});

it("rejects a mismatched linked release projection", async () => {
  ports.findTicket.mockResolvedValue(change);
  ports.releases.mockResolvedValue([{id: "release-1", organizationId: "replacement", releaseTag: "foreign"}]);
  expect((await GET(request("?changeTicketId=same-id"))).status).toBe(503);
});

it.each([
  {label: "ticket removed", next: null},
  {label: "link replaced", next: ["replacement-release"]},
  {label: "link added", next: ["release-1", "new-release"]},
])("withholds linked release details if the ticket association changes during the read ($label)", async ({next}) => {
  ports.findTicket.mockResolvedValueOnce(change).mockResolvedValueOnce(next === null ? null : {...change, linkedReleaseIds: next});
  ports.releases.mockResolvedValue([{id: "release-1", organizationId: actor.organizationId, releaseTag: "v2.14.0"}]);
  const response = await GET(request("?changeTicketId=same-id"));
  expect(ports.findTicket).toHaveBeenCalledTimes(2);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ok: false, error: "ticket_links_unavailable"});
});

it("reads the canonical ReleaseOps record through the current incident and returns a bounded projection", async () => {
  const linked = {id: "release-1", organizationId: actor.organizationId, releaseTag: "v2.14.0", commitSha: "a".repeat(40), status: "failed", summary: "private internal note"};
  ports.incident.mockResolvedValue(incident);
  ports.release.mockResolvedValue(linked);
  const response = await GET(request("?deploymentIncidentId=same-id"));
  expect(response.status).toBe(200);
  expect(ports.incident).toHaveBeenCalledTimes(2);
  expect(ports.release).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({where:{id:"release-1",organizationId:actor.organizationId}}));
  expect(await response.json()).toEqual({ok:true,data:{
    workspaceId:actor.organizationId,actorId:actor.userId,incidentId:"same-id",incidentStatus:"open",
    release:{id:"release-1",tag:"v2.14.0",commit:"a".repeat(40),status:"failed"},
  }});
});

it.each(["foreign incident", "foreign release", "changed link", "closed incident", "changed actor"] as const)(
  "withholds incident release facts for %s", async reason => {
    ports.incident.mockResolvedValueOnce(reason === "foreign incident" ? {...incident, organizationId:"foreign"} : incident)
      .mockResolvedValue(reason === "changed link" ? {...incident,releaseId:"other"} : reason === "closed incident" ? {...incident,status:"resolved"} : incident);
    ports.release.mockResolvedValue({id:"release-1",organizationId:reason === "foreign release" ? "foreign" : actor.organizationId,releaseTag:"v1",commitSha:"a".repeat(40),status:"failed"});
    if (reason === "changed actor") ports.resolve.mockResolvedValueOnce(actor).mockResolvedValueOnce({...actor,userId:"replacement"});
    const response=await GET(request("?deploymentIncidentId=same-id"));
    expect(response.status).toBe(reason==="foreign incident"?404:reason==="changed actor"?403:409);
    expect((await response.json()).data).toBeUndefined();
    if (reason === "foreign incident") expect(ports.release).not.toHaveBeenCalled();
  },
);

it("opts evidence in without expanding the release projection for older callers", async () => {
  const release = {id:"release-1",organizationId:actor.organizationId,releaseTag:"v1",commitSha:"a".repeat(40),status:"failed"};
  ports.incident.mockResolvedValue(incident);
  ports.release.mockResolvedValue(release);
  ports.evidence.mockResolvedValue(null);
  const path = "?deploymentIncidentId=same-id";
  expect((await (await GET(request(path))).json()).data.evidence).toBeUndefined();
  expect(ports.evidence).not.toHaveBeenCalled();
  const response = await GET(request(path+"&includeReleaseEvidence=1"));
  expect((await response.json()).data.evidence).toEqual({state:"missing"});
  expect(ports.evidence).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({where:{organizationId:actor.organizationId,releaseId:"release-1"}}));

  ports.release.mockResolvedValueOnce(release).mockResolvedValueOnce({...release,commitSha:"b".repeat(40)});
  expect((await GET(request(path+"&includeReleaseEvidence=1"))).status).toBe(409);
  expect((await GET(request(path+"&includeReleaseEvidence=0"))).status).toBe(400);
});

const recoveryPath = "?deploymentIncidentId=same-id&includeReleaseRecovery=1";
const sourceRelease = {
  id: incident.releaseId, organizationId: actor.organizationId, releaseTag: "v1.9.3",
  commitSha: "a".repeat(40), status: "failed", applicationId: "app-1",
  targetEnvironmentId: "staging", rollbackReferenceReleaseId: "prior-release",
};
const priorRelease = {...sourceRelease, id: "prior-release", releaseTag: "v1.9.2", commitSha: "b".repeat(40)};

it("returns the rollback reference only when requested and scopes the lookup to the original release", async () => {
  ports.incident.mockResolvedValue(incident);
  ports.release.mockResolvedValueOnce(sourceRelease);
  expect((await (await GET(request("?deploymentIncidentId=same-id"))).json()).data.recovery).toBeUndefined();
  expect(ports.release).toHaveBeenCalledTimes(1);
  ports.release.mockResolvedValueOnce(sourceRelease).mockResolvedValueOnce(priorRelease).mockResolvedValueOnce(sourceRelease);
  const response = await GET(request(recoveryPath));
  expect(response.status).toBe(200);
  expect(ports.release).toHaveBeenNthCalledWith(3, expect.objectContaining({where: {
    id: "prior-release", organizationId: actor.organizationId, applicationId: "app-1", targetEnvironmentId: "staging",
  }}));
  expect((await response.json()).data.recovery).toEqual({
    state: "recorded", releaseId: "prior-release", tag: "v1.9.2", commit: "b".repeat(40),
  });
  expect(ports.evidence).not.toHaveBeenCalled();
});

it.each([
  null,
  {...priorRelease, organizationId: "foreign"},
  {...priorRelease, applicationId: "another-app"},
  {...priorRelease, targetEnvironmentId: "production"},
  {...priorRelease, commitSha: null},
])("withholds an unverifiable rollback reference", async target => {
  ports.incident.mockResolvedValue(incident);
  ports.release.mockResolvedValueOnce(sourceRelease).mockResolvedValueOnce(target).mockResolvedValueOnce(sourceRelease);
  const response = await GET(request(recoveryPath));
  expect(response.status).toBe(200);
  expect((await response.json()).data.recovery).toEqual({state: "unavailable"});
});

it.each([
  [null, "missing"],
  ["release-1", "unavailable"],
  ["invalid/id", "unavailable"],
])("skips the target read for a missing or invalid reference (%s)", async (reference, state) => {
  ports.incident.mockResolvedValue(incident);
  ports.release.mockResolvedValue({...sourceRelease, rollbackReferenceReleaseId: reference});
  expect((await (await GET(request(recoveryPath))).json()).data.recovery).toEqual({state});
  expect(ports.release).toHaveBeenCalledTimes(2);
});

it("rejects a recovery lookup when the reference changes during the read", async () => {
  ports.incident.mockResolvedValue(incident);
  ports.release.mockResolvedValueOnce(sourceRelease).mockResolvedValueOnce(priorRelease)
    .mockResolvedValueOnce({...sourceRelease, rollbackReferenceReleaseId: "replacement"});
  const response = await GET(request(recoveryPath));
  expect(response.status).toBe(409);
  expect((await response.json()).data).toBeUndefined();
});

const activityPath = "?incidentActivityId=same-id";
const activityIncident = {...incident, updatedAt: time};
const auditRow = {
  id: "event-1", organizationId: actor.organizationId, subjectKind: "release", subjectId: incident.id,
  kind: "deployment_incident.reopen", outcome: "ok", createdAt: time, summary: "internal details",
};

it("returns only bounded successful transition metadata for the exact incident", async () => {
  ports.incident.mockResolvedValue(activityIncident);
  ports.audit.mockResolvedValue(Array.from({length: 21}, (_, index) => ({...auditRow, id: `event-${index}`})));
  const response = await GET(request(activityPath));
  expect(response.status).toBe(200);
  expect(ports.audit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    where: {organizationId: actor.organizationId, subjectKind: "release", subjectId: incident.id,
      outcome: "ok", kind: {in: ["deployment_incident.mitigate", "deployment_incident.resolve",
        "deployment_incident.reopen", "deployment_incident.wont_fix"]}},
    orderBy: [{createdAt: "desc"}, {id: "desc"}], take: 21,
  }));
  const {data} = await response.json();
  expect(data).toMatchObject({workspaceId: actor.organizationId, actorId: actor.userId, incidentId: incident.id,
    releaseId: incident.releaseId, limited: true});
  expect(data.events).toHaveLength(20);
  expect(data.events[0]).toEqual({id: "event-0", action: "reopen", recordedAt: time.toISOString()});
  expect(ports.release).not.toHaveBeenCalled();
});

it.each([
  {...auditRow, organizationId: "foreign"},
  {...auditRow, subjectId: incident.releaseId},
  {...auditRow, kind: "deployment_incident.report"},
  {...auditRow, outcome: "rejected"},
])("rejects mis-scoped audit rows", async row => {
  ports.incident.mockResolvedValue(activityIncident);
  ports.audit.mockResolvedValue([row]);
  expect((await GET(request(activityPath))).status).toBe(503);
});

it("rejects an incident update during the history read, even when its status and release return to their old values", async () => {
  ports.incident.mockResolvedValueOnce(activityIncident)
    .mockResolvedValueOnce({...activityIncident, updatedAt: new Date(time.getTime() + 1)});
  ports.audit.mockResolvedValue([auditRow]);
  expect((await GET(request(activityPath))).status).toBe(409);
});

it("withholds transition metadata if the paired user changes during the read", async () => {
  ports.incident.mockResolvedValue(activityIncident);
  ports.audit.mockResolvedValue([auditRow]);
  ports.resolve.mockResolvedValueOnce(actor).mockResolvedValueOnce({...actor, userId: "other-user"});
  expect((await GET(request(activityPath))).status).toBe(403);
});

const triagePath = "?incidentTriageId=same-id";
const triageRow = {
  id: "triage-1", incidentId: incident.id, organizationId: actor.organizationId, priority: "P1",
  suggestedOwnerTeam: "platform-sre", rationale: "Recorded engine rationale", operatorDecision: "overridden",
  decidedAt: time, overridePriority: "P2", generatedAt: time, decisionNote: "private note", decidedByUserId: "private author",
};

it("reads the latest scoped recommendation and projects only the saved decision fields", async () => {
  ports.incident.mockResolvedValue(activityIncident);
  ports.triage.mockResolvedValue(triageRow);
  const response = await GET(request(triagePath));
  expect(response.status).toBe(200);
  expect(ports.triage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    where: {organizationId: actor.organizationId, incidentId: incident.id},
    orderBy: [{generatedAt: "desc"}, {id: "desc"}],
  }));
  expect((await response.json()).data).toEqual({
    workspaceId: actor.organizationId, actorId: actor.userId, incidentId: incident.id, releaseId: incident.releaseId,
    recommendation: {id: "triage-1", priority: "P1", suggestedTeam: "platform-sre", rationale: "Recorded engine rationale",
      generatedAt: time.toISOString(), decision: "overridden", decidedAt: time.toISOString(), overridePriority: "P2"},
  });
});

it.each([null, {...triageRow, operatorDecision: "dismissed", decidedAt: null, overridePriority: null}])(
  "preserves a missing recommendation or an automatic dismissal without inventing a decision time", async row => {
    ports.incident.mockResolvedValue(activityIncident);
    ports.triage.mockResolvedValue(row);
    const response = await GET(request(triagePath));
    expect(response.status).toBe(200);
    const {data} = await response.json();
    if (row) expect(data.recommendation).toMatchObject({decision: "dismissed", decidedAt: null});
    else expect(data.recommendation).toBeNull();
  },
);

it.each([
  {...triageRow, organizationId: "foreign"},
  {...triageRow, incidentId: "other"},
  {...triageRow, decidedAt: null},
  {...triageRow, overridePriority: null},
])("withholds malformed or mis-scoped triage", async row => {
  ports.incident.mockResolvedValue(activityIncident);
  ports.triage.mockResolvedValue(row);
  expect((await GET(request(triagePath))).status).toBe(503);
});

const catalogRelease = {id: incident.releaseId, organizationId: actor.organizationId,
  applicationId: "application-1", targetEnvironmentId: "environment-1"};
const catalogApplication = {id: catalogRelease.applicationId, organizationId: actor.organizationId, name: "Inventory service"};
const catalogEnvironment = {id: catalogRelease.targetEnvironmentId, organizationId: actor.organizationId, name: "Staging"};

it("reads one scoped catalog batch for incidents sharing the exact saved release", async () => {
  ports.releases.mockResolvedValue([catalogRelease]);
  ports.apps.mockResolvedValue([catalogApplication]);
  ports.environments.mockResolvedValue([catalogEnvironment]);
  ports.incidents.mockResolvedValue([incident, {...incident, id: "another-incident"}]);
  const response = await GET(request());
  expect(response.status).toBe(200);
  for (const [query, id] of [
    [ports.releases, catalogRelease.id], [ports.apps, catalogApplication.id], [ports.environments, catalogEnvironment.id],
  ] as const) {
    expect(query).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({where: {
      organizationId: actor.organizationId, id: {in: [id]},
    }}));
  }
  const {data} = await response.json();
  expect(data.records.filter((row: {kind: string}) => row.kind === "incident")).toMatchObject([
    {id: incident.id, releaseContext: {application: "Inventory service", environment: "Staging"}},
    {id: "another-incident", releaseContext: {application: "Inventory service", environment: "Staging"}},
  ]);
});

it("withholds a catalog record from another workspace while retaining independently scoped context", async () => {
  ports.releases.mockResolvedValue([catalogRelease]);
  ports.apps.mockResolvedValue([catalogApplication]);
  ports.environments.mockResolvedValue([{...catalogEnvironment, organizationId: "foreign", name: "Private environment"}]);
  const response = await GET(request());
  expect(response.status).toBe(200);
  const {data} = await response.json();
  expect(data.records[1].releaseContext).toEqual({application: "Inventory service", environment: null});
  expect(JSON.stringify(data)).not.toContain("Private environment");
});

it("returns tickets when the catalog read fails and never joins through a foreign release", async () => {
  ports.releases.mockRejectedValueOnce(new Error("Unavailable releases"))
    .mockResolvedValueOnce([{...catalogRelease, organizationId: "foreign"}]);
  for (let read = 0; read < 2; read++) {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const {data} = await response.json();
    expect(data.records[1].releaseContext).toBeNull();
  }
  expect(ports.apps).not.toHaveBeenCalled();
  expect(ports.environments).not.toHaveBeenCalled();
});
