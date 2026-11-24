import { statSync } from "node:fs";
import { PrismaClient } from "@/lib/prismaClient";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";
import { GET } from "../route";
import { POST as createDraft } from "../../deployments/drafts/route";
import { GET as reportReleases, POST as reportIncident } from "../incident-report/route";
import {POST as generateRemediation} from "@/app/api/dashboard/remediation-generate/route";
import {POST as decideRemediation} from "@/app/api/dashboard/remediation-decide/route";
import { POST as transitionIncident } from "@/app/api/dashboard/deployment-incident-transition/route";
import { POST as generateTriage } from "@/app/api/dashboard/incident-triage-generate/route";
import { POST as decideTriage } from "@/app/api/dashboard/incident-triage-decide/route";
import {generateEvidencePack} from "@/lib/releaseops/evidencePackGenerator";

const ports = vi.hoisted(() => ({db: null as PrismaClient | null, resolve: vi.fn(), webContext: vi.fn()}));
vi.mock("@/lib/auth/currentContext", () => ({currentContext: ports.webContext}));
vi.mock("@/lib/db", () => ({get prisma() {return ports.db;}}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({resolveRequestDesktopSession: ports.resolve}));

const host = process.env.V19_INCIDENT_OWNED_SOCKET;
it.skipIf(!host)("resolves a persisted incident even when its release has no desktop request", async () => {
  if (!host || !/^\/(?:private\/)?tmp\/v19-incident-owned-[^/]+\/socket$/.test(host)) throw Error("owned socket required");
  const socket = statSync(host);
  if (socket.uid !== process.getuid?.() || (socket.mode & 0o077) !== 0) throw Error("owned socket required");
  const db = new PrismaClient({adapter: new PrismaPg({host, user:"v19_incident_fixture", database:"postgres"})});
  try {
    const [identity] = await db.$queryRaw<{owned: boolean}[]>`SELECT current_user = 'v19_incident_fixture' AND current_setting('listen_addresses') = '' AS owned`;
    if (!identity?.owned) throw Error("owned socket required");
    const organizationId = "fixture-org";
    const releaseId = "releaseops-only";
    const actor = {id:"fixture-session",userId:"fixture-user",organizationId,credentialKind:"desktop_session",capabilities:["workspace:read"]};
    const releaseScope = {organizationId, applicationId: "fixture-application", targetEnvironmentId: "fixture-staging"};
    const prior = await db.release.create({data:{
      ...releaseScope, id: "prior-release", releaseTag: "v1.9.2", commitSha: "c".repeat(40), status: "deployed",
    }});
    const release = await db.release.create({data:{...releaseScope,id:releaseId,rollbackReferenceReleaseId:prior.id,releaseTag:"v1.9.3",commitSha:"a".repeat(40),status:"failed"}});
    await db.deploymentIncident.create({data:{id:"fixture-incident",organizationId,releaseId,severity:"high",title:"Fixture incident",reportedByUserId:actor.userId}});
    expect(await db.tauriDeploymentRequest.findUnique({where:{id:releaseId}})).toBeNull();
    ports.db = db;
    ports.resolve.mockResolvedValue(actor);
    await db.application.create({data:{
      id:releaseScope.applicationId, organizationId, slug:"inventory", name:"Inventory service",
    }});
    await db.environment.create({data:{
      id:releaseScope.targetEnvironmentId, organizationId, slug:"stage", name:"Staging", tier:"stage",
    }});
    const directory = new NextRequest("http://localhost/api/desktop/tickets");
    const linkedContext = async () => {
      const response = await GET(directory);
      expect(response.status).toBe(200);
      const {data} = await response.json();
      return data.records.find((row: {id: string}) => row.id === "fixture-incident").releaseContext;
    };
    expect(await linkedContext()).toEqual({application:"Inventory service", environment:"Staging"});
    await db.environment.update({where:{id:releaseScope.targetEnvironmentId},data:{organizationId:"foreign-org"}});
    expect(await linkedContext()).toEqual({application:"Inventory service", environment:null});
    const request = () => new NextRequest("http://localhost/api/desktop/tickets?deploymentIncidentId=fixture-incident");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok:true,data:{
      workspaceId:organizationId,actorId:actor.userId,incidentId:"fixture-incident",incidentStatus:"open",
      release:{id:releaseId,tag:"v1.9.3",commit:"a".repeat(40),status:"failed"},
    }});
    const recoveryRequest = new NextRequest(request().url+"&includeReleaseRecovery=1");
    expect((await (await GET(recoveryRequest)).json()).data.recovery).toEqual({
      state: "recorded", releaseId: prior.id, tag: "v1.9.2", commit: "c".repeat(40),
    });
    await db.release.update({where: {id: prior.id}, data: {targetEnvironmentId: "fixture-production"}});
    expect((await (await GET(recoveryRequest)).json()).data.recovery).toEqual({state: "unavailable"});
    const evaluatedAt = new Date("2026-11-20T12:00:00.000Z");
    const snapshot = await db.releaseReadinessSnapshot.create({data:{
      organizationId,releaseId,evaluatedAt,overallScore:72,riskLevel:"high",
      branchGovernance:70,changeCompliance:70,artifactTraceability:70,secretTraceability:70,
      rollbackReadiness:70,communicationReadiness:70,driftRisk:70,manualReconciliation:70,
      blockersJson:[{privateDetail:"fixture details must stay in the pack"}],evaluationSource:"manual",
    }});
    const {content,contentHash}=generateEvidencePack({
      release,repository:null,latestReadiness:snapshot,prs:[],cherryPicks:[],linkedTickets:[],branchChecks:[],
    },{now:evaluatedAt});
    await db.releaseEvidencePack.create({data:{organizationId,releaseId,contentHash,contentJson:JSON.parse(JSON.stringify(content))}});
    const evidenceRequest = new NextRequest(request().url+"&includeReleaseEvidence=1");
    expect((await (await GET(evidenceRequest)).json()).data.evidence).toEqual({
      state:"recorded",generatedAt:evaluatedAt.toISOString(),branchCheckCount:0,changeTicketCount:0,
      readiness:{score:72,evaluatedAt:evaluatedAt.toISOString()},
    });
    const repository = await db.repository.create({data:{
      organizationId,provider:"github",remoteOwner:"fixture-owner",remoteName:"inventory",
      remoteUrl:"https://github.com/fixture-owner/inventory.git",
    }});
    const binding = {evidenceRepositoryId:repository.id};
    await db.environment.update({where:{id:releaseScope.targetEnvironmentId},data:{organizationId}});
    await db.release.update({where:{id:prior.id},data:{targetEnvironmentId:releaseScope.targetEnvironmentId}});
    await db.release.updateMany({where:{id:{in:[releaseId,prior.id]},organizationId},data:binding});
    const workflow = {organizationId,repositoryId:repository.id,workflowName:"Validate staging",commitSha:release.commitSha,
      status:"completed",conclusion:"failure",lastSyncedAt:evaluatedAt};
    const detailsUrl = "https://github.com/fixture-owner/inventory/actions/runs/17";
    await db.workflowRunRecord.createMany({data:[
      {...workflow,externalRunId:"17",webUrl:detailsUrl},
      {...workflow,externalRunId:"18",webUrl:detailsUrl+"?unexpected=1"},
      {...workflow,externalRunId:"19",webUrl:detailsUrl,commitSha:"b".repeat(40)},
      {...workflow,externalRunId:"20",webUrl:detailsUrl,organizationId:"foreign-org"},
      {...workflow,externalRunId:"21",webUrl:detailsUrl,repositoryId:"another-repo"},
    ]});
    const sourcesRequest = () => new NextRequest(request().url+"&includeIncidentSources=1");
    expect((await (await GET(sourcesRequest())).json()).data).not.toHaveProperty("sources");
    const githubActor = {...actor,capabilities:["workspace:read","github:read"]};
    ports.resolve.mockResolvedValue(githubActor);
    const sourced = (await (await GET(sourcesRequest())).json()).data;
    expect(sourced.sources).toEqual({
      state:"recorded",repository:"fixture-owner/inventory",commit:release.commitSha,limited:true,
      runs:[{runId:"17",name:"Validate staging",status:"completed",conclusion:"failure",observedAt:evaluatedAt.toISOString()}],
      comparison:{baselineCommit:prior.commitSha,baselineTag:prior.releaseTag},
    });
    expect((await (await GET(evidenceRequest)).json()).data).not.toHaveProperty("sources");
    ports.resolve.mockResolvedValueOnce(githubActor).mockResolvedValueOnce(actor);
    expect((await GET(sourcesRequest())).status).toBe(403);
    await db.release.update({where:{id:prior.id},data:{evidenceRepositoryId:"another-repo"}});
    expect((await (await GET(sourcesRequest())).json()).data.sources.comparison).toBeNull();
    await db.release.update({where:{id:prior.id},data:binding});
    await db.environment.update({where:{id:releaseScope.targetEnvironmentId},data:{organizationId:"foreign-org"}});
    expect((await (await GET(sourcesRequest())).json()).data.sources.comparison).toBeNull();
    await db.repository.update({where:{id:repository.id},data:{remoteUrl:"https://github.example.com/fixture-owner/inventory.git"}});
    expect((await (await GET(sourcesRequest())).json()).data.sources).toEqual({state:"unavailable"});
    ports.resolve.mockResolvedValue(actor);

    await db.release.update({where:{id:releaseId},data:{commitSha:"b".repeat(40)}});
    expect((await (await GET(evidenceRequest)).json()).data.evidence).toEqual({state:"unavailable"});
    ports.webContext.mockResolvedValue({...actor, isAuthenticated: true});
    for (const action of ["mitigate", "reopen"]) {
      const result = await transitionIncident(new NextRequest("http://localhost/api/dashboard/deployment-incident-transition", {
        method: "POST", body: JSON.stringify({incidentId: "fixture-incident", action}),
      }));
      expect(result.status).toBe(200);
    }
    expect(await db.deploymentIncident.findUnique({where:{id:"fixture-incident"}})).toMatchObject({status:"open",mitigatedAt:null});
    const historyRequest = new NextRequest("http://localhost/api/desktop/tickets?incidentActivityId=fixture-incident");
    const history = await GET(historyRequest);
    expect(history.status).toBe(200);
    const {data} = await history.json();
    expect(data.events.map((event: {action: string}) => event.action).sort()).toEqual(["mitigate","reopen"]);
    expect(data).toMatchObject({incidentId:"fixture-incident",releaseId,limited:false});
    const triageRequest = new NextRequest("http://localhost/api/desktop/tickets?incidentTriageId=fixture-incident");
    expect((await (await GET(triageRequest)).json()).data.recommendation).toBeNull();
    ports.webContext.mockResolvedValue({...actor, isAuthenticated: true, roles: ["operator"]});
    const generated = await generateTriage(new NextRequest("http://localhost/api/dashboard/incident-triage-generate", {
      method: "POST", body: JSON.stringify({incidentId: "fixture-incident"}),
    }));
    expect(generated.status).toBe(200);
    const {data: {triage}} = await generated.json();
    const readTarget = async () => {
      const response = await GET(directory);
      expect(response.status).toBe(200);
      return (await response.json()).data.records.find((ticket: {id:string}) => ticket.id === "fixture-incident").responseTarget;
    };
    const suggestedTarget = await readTarget();
    expect(suggestedTarget).toMatchObject({priority:triage.priority,decision:"suggested",deadline:expect.any(String)});
    const row = await db.incidentTriage.findUniqueOrThrow({where:{id:triage.id}});
    const targetSnapshot = (row.inputsJson as {responseTarget:{generatedAt:string;deadline:string}}).responseTarget;
    expect(suggestedTarget.deadline).toBe(targetSnapshot.deadline);

    expect((await (await GET(triageRequest)).json()).data.recommendation).toMatchObject({
      id: triage.id, priority: triage.priority, decision: "pending", decidedAt: null,
    });
    const decided = await decideTriage(new NextRequest("http://localhost/api/dashboard/incident-triage-decide", {
      method: "POST", body: JSON.stringify({triageId: triage.id, action: "override", overridePriority: "P2", note: "fixture note"}),
    }));
    expect(decided.status).toBe(200);
    const projected = (await (await GET(triageRequest)).json()).data.recommendation;
    expect(projected).toMatchObject({
      id: triage.id, priority: triage.priority, decision: "overridden", overridePriority: "P2", decidedAt: expect.any(String),
    });
    expect(projected.decisionNote).toBeUndefined();
    expect(await readTarget()).toEqual({
      decision:"overridden",priority:"P2",deadline:new Date(Date.parse(targetSnapshot.generatedAt)+240*60_000).toISOString(),
    });
    await db.incidentTriage.update({where:{id:triage.id},data:{inputsJson:{
      ...(row.inputsJson as Record<string, never>),responseTarget:{...targetSnapshot,releaseId:"another-release"},
    }}});
    expect(await readTarget()).toBeUndefined();

    const reviewRequest = () => new NextRequest("http://localhost/api/desktop/tickets?incidentRemediationId=fixture-incident");
    const review = async () => {
      const response = await GET(reviewRequest());
      expect(response.status).toBe(200);
      return (await response.json()).data;
    };
    expect((await review()).proposal).toBeNull();
    const generateReview = await generateRemediation(new NextRequest("http://localhost/api/dashboard/remediation-generate", {
      method:"POST",body:JSON.stringify({incidentId:"fixture-incident"}),
    }));
    expect(generateReview.status).toBe(200);
    const pending = await review();
    expect(pending.proposal).toMatchObject({binding:"current",decision:"pending",decidedAt:null});
    const decision = await decideRemediation(new NextRequest("http://localhost/api/dashboard/remediation-decide", {
      method:"POST",body:JSON.stringify({proposalId:pending.proposal.id,action:"accept",note:"private fixture note"}),
    }));
    expect(decision.status).toBe(200);
    const reviewed = await review();
    expect(reviewed.proposal).toMatchObject({binding:"current",decision:"accepted",decidedAt:expect.any(String)});
    expect(JSON.stringify(reviewed)).not.toContain("private fixture note");
    await db.release.update({where:{id:releaseId},data:{commitSha:"d".repeat(40)}});
    expect((await review()).proposal).toMatchObject({binding:"historical",decision:"accepted"});
    await db.release.update({where:{id:releaseId},data:{commitSha:"b".repeat(40)}});
    expect((await review()).proposal).toMatchObject({binding:"current",decision:"accepted"});
    await db.deploymentIncident.update({where:{id:"fixture-incident"},data:{updatedAt:new Date(Date.now()+1000)}});
    expect((await review()).proposal).toMatchObject({binding:"historical",decision:"accepted"});

    const changeSource = await db.changeTicket.create({data:{
      organizationId,provider:"servicenow",externalKey:"CHG-100",title:"Fixture change",ticketType:"change_request",status:"pending",
    }});
    const draftPayload = {title:"Resolve release details",applications:["Inventory service"],
      requestDetails:"Verify the saved source change",sourceChangeTicketId:changeSource.id};
    const requestDraft = () => new NextRequest("http://localhost/api/desktop/deployments/drafts",{
      method:"POST",headers:{"content-type":"application/json","x-correlation-id":"fixture-source-draft"},
      body:JSON.stringify(draftPayload),
    });
    const drafted = await createDraft(requestDraft());
    expect(drafted.status).toBe(201);
    const {data:draftReceipt} = await drafted.json();
    expect((await createDraft(requestDraft())).status).toBe(200);
    expect(await db.tauriDeploymentRequest.findFirst({where:{id:draftReceipt.id, organizationId}})).toMatchObject({
      status:"draft", version:1, submittedAt:null,
      intakeJson:{sourceTicket:{id:changeSource.id,provider:"servicenow",reference:"CHG-100"}},
    });
    ports.resolve.mockResolvedValue({...actor,userId:"another-fixture-user"});
    expect((await createDraft(requestDraft())).status).toBe(409);
    ports.resolve.mockResolvedValue(actor);
    const reportUrl = "http://localhost/api/desktop/tickets/incident-report";
    const dataForReport = {workspaceId:organizationId,actorId:actor.userId,releaseId,
      severity:"critical",title:"New release incident",summary:"Observed validation failure",attemptId:"b73f99f7-91e2-4e49-8cd1-63087cc65f58"};
    const submit = (change = {}) => reportIncident(new NextRequest(reportUrl, {
      method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({...dataForReport,...change}),
    }));
    await db.orgMembership.create({data:{organizationId, userId:actor.userId, role:"operator", acceptedAt:new Date()}});
    await db.desktopSessionRecord.create({data:{
      id:actor.id, userId:actor.userId, organizationId, deviceFingerprint:"synthetic", deviceLabel:"Fixture",
      platform:"macos", issuedAt:new Date(), lastSeenAt:new Date(), expiresAt:new Date(Date.now()+60000),
    }});
    ports.resolve.mockResolvedValue({...actor, role:"read_only"});
    expect((await submit()).status).toBe(403);
    ports.resolve.mockResolvedValue({...actor, role:"operator"});
    const suggested = await reportReleases(new NextRequest(reportUrl));
    expect((await suggested.json()).data.releases).toContainEqual({id:releaseId,tag:"v1.9.3"});
    expect((await submit({workspaceId:"foreign-org"})).status).toBe(403);
    await db.release.create({data:{id:"foreign-release",organizationId:"foreign-org",applicationId:"foreign-app"}});
    const missingRelease = await submit({releaseId:"foreign-release"});
    expect(await missingRelease.json()).toEqual({ok:false,error:"incident_release_not_found"});
    expect(missingRelease.status).toBe(404);
    const outcomes = await Promise.all([submit(), submit()]);
    expect(outcomes.map(outcome => outcome.status).sort()).toEqual([200,201]);
    const [{data:first},{data:second}] = await Promise.all(outcomes.map(outcome=>outcome.json()));
    expect(first).toEqual(second);
    expect(await db.deploymentIncident.findUnique({where:{id:first.incidentId}})).toMatchObject({
      organizationId,releaseId,reportedByUserId:actor.userId,title:dataForReport.title,severity:"critical",status:"open",
    });
    expect(await db.auditEvent.count({where:{organizationId,kind:"deployment_incident.report",correlationId:dataForReport.attemptId}})).toBe(1);
    expect((await submit({title:"Different incident"})).status).toBe(409);
    // Reject closure audit writes to verify that the web transition rolls back too.
    const resolveIncident = () => transitionIncident(new NextRequest("http://localhost/api/dashboard/deployment-incident-transition", {
      method: "POST", body: JSON.stringify({incidentId: "fixture-incident", action: "resolve"}),
    }));
    const priorIncident = await db.deploymentIncident.findUniqueOrThrow({where:{id:"fixture-incident"}});
    await db.$executeRaw`ALTER TABLE "AuditEvent" ADD CONSTRAINT "fixture_reject_closure" CHECK ("kind" <> 'deployment_incident.resolve')`;
    try {
      expect((await resolveIncident()).status).toBe(503);
      expect(await db.deploymentIncident.findUnique({where:{id:"fixture-incident"}})).toEqual(priorIncident);
    } finally {
      await db.$executeRaw`ALTER TABLE "AuditEvent" DROP CONSTRAINT "fixture_reject_closure"`;
    }
    const closures = await Promise.all([resolveIncident(), resolveIncident()]);
    expect(closures.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await db.deploymentIncident.findUnique({where:{id:"fixture-incident"}})).toMatchObject({
      status:"resolved", resolvedAt:expect.any(Date), resolvedByUserId:actor.userId,
    });
    expect((await (await GET(historyRequest)).json()).data.events.filter(
      (event: {action:string}) => event.action === "resolve",
    )).toHaveLength(1);

    await db.desktopSessionRecord.update({where:{id:actor.id},data:{revokedAt:new Date()}});
    expect((await submit()).status).toBe(403);
    await db.desktopSessionRecord.update({where:{id:actor.id},data:{revokedAt:null}});
    await db.orgMembership.update({where:{userId_organizationId:{userId:actor.userId,organizationId}},data:{role:"read_only"}});
    expect((await submit()).status).toBe(403);
    ports.resolve.mockResolvedValue({...actor,organizationId:"foreign-org"});
    expect((await GET(request())).status).toBe(404);
  } finally {
    await db.$disconnect();
    ports.db = null;
  }
});
