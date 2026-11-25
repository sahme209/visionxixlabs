import {statSync} from "node:fs";
import {createRequire} from "node:module";
import type {PrismaClient as Client} from "@/lib/prismaClient";
import {PrismaPg} from "@prisma/adapter-pg";
import {NextRequest} from "next/server";
import {expect, it, vi} from "vitest";
import {GET,POST} from "../incident-collection/route";

const ports = vi.hoisted(() => ({db: null as Client | null, resolve: vi.fn()}));
vi.mock("@/lib/db", () => ({get prisma() { return ports.db; }}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({resolveRequestDesktopSession: ports.resolve}));

// Use the generated client from this checkout, even when dependencies are shared.
const {PrismaClient} = createRequire(import.meta.url)("../../../../../lib/generated/prisma/client.js") as typeof import("@/lib/prismaClient");

const host = process.env.V19_INCIDENT_OWNED_SOCKET;
it.skipIf(!host)("records only an exact repository evidence collection and replays its receipt", async () => {
  if (!host || !/^\/(?:private\/)?tmp\/v19-incident-owned-[^/]+\/socket$/.test(host)) throw Error("owned socket required");
  const socket = statSync(host);
  if (socket.uid !== process.getuid?.() || (socket.mode & 0o077) !== 0) throw Error("owned socket required");
  const db = new PrismaClient({adapter: new PrismaPg({host, user:"v19_incident_fixture", database:"postgres"})});
  try {
    const [identity] = await db.$queryRaw<{owned: boolean}[]>`SELECT current_user = 'v19_incident_fixture' AND current_setting('listen_addresses') = '' AS owned`;
    if (!identity?.owned) throw Error("owned socket required");
    const organizationId = "collection-workspace";
    const incidentId = "collection-incident";
    const releaseId = "collection-release";
    const actor = {id:"collection-session", userId:"collection-user", organizationId, credentialKind:"desktop_session",
      role:"operator", capabilities:["workspace:read","github:read"]};
    ports.db = db;
    ports.resolve.mockResolvedValue(actor);
    await db.orgMembership.create({data:{organizationId,userId:actor.userId,role:"operator",acceptedAt:new Date()}});
    await db.desktopSessionRecord.create({data:{
      id:actor.id, userId:actor.userId, organizationId, deviceFingerprint:"synthetic", deviceLabel:"Fixture",
      platform:"macos", issuedAt:new Date(), lastSeenAt:new Date(), expiresAt:new Date(Date.now()+60000),
    }});
    const app = await db.application.create({data:{organizationId,name:"Inventory",slug:"inventory"}});
    const env = await db.environment.create({data:{organizationId,name:"Staging",slug:"staging",tier:"stage"}});
    const repo = await db.repository.create({data:{organizationId,provider:"github",remoteOwner:"fixture-owner",
      remoteName:"inventory",remoteUrl:"https://github.com/fixture-owner/inventory.git"}});
    const binding = {organizationId,applicationId:app.id,targetEnvironmentId:env.id,evidenceRepositoryId:repo.id};
    const baseline = await db.release.create({data:{...binding,commitSha:"b".repeat(40),releaseTag:"v1.9.2"}});
    const release = await db.release.create({data:{...binding,id:releaseId,commitSha:"a".repeat(40),releaseTag:"v1.9.3",
      rollbackReferenceReleaseId:baseline.id}});
    const synced = new Date("2026-11-23T10:45:00Z");
    await db.workflowRunRecord.create({data:{organizationId,repositoryId:repo.id,workflowName:"Validate staging",
      externalRunId:"17",commitSha:release.commitSha,status:"completed",conclusion:"failure",lastSyncedAt:synced,
      webUrl:"https://github.com/fixture-owner/inventory/actions/runs/17"}});
    const incident = await db.deploymentIncident.create({data:{
      id:incidentId,organizationId,releaseId,severity:"high",title:"Fixture incident",reportedByUserId:actor.userId,
    }});



    const target = "http://localhost/api/desktop/tickets/incident-collection";
    const command = {
      workspaceId:organizationId,actorId:actor.userId,incidentId,releaseId,incidentRevision:incident.updatedAt.toISOString(),
      repository:"fixture-owner/inventory",commit:release.commitSha,baselineCommit:baseline.commitSha,runId:"17",
      observedAt:synced.toISOString(),attemptId:"bfae3e76-aa99-457c-8856-4a96689ba115",
    };
    const submit = (changes = {}) => POST(new NextRequest(target,{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...command,...changes}),
    }));
    const read = async () => (await GET(new NextRequest(target+`?incidentId=${incidentId}`))).json();
    expect((await read()).data.collectedAt).toBeNull();
    expect((await submit({runId:"18"})).status).toBe(409);
    expect((await submit({baselineCommit:"c".repeat(40)})).status).toBe(409);
    expect((await submit({observedAt:"2026-11-23T10:44:00.000Z"})).status).toBe(409);
    expect((await submit({workspaceId:"foreign-org"})).status).toBe(403);
    const replies = await Promise.all([submit(),submit()]);
    expect(replies.map(reply => reply.status)).toEqual([200,200]);
    const [first,replay] = await Promise.all(replies.map(reply => reply.json()));
    expect(first).toEqual(replay);
    const readAttempt = (attemptId = command.attemptId) => GET(
      new NextRequest(target + "?" + new URLSearchParams({incidentId,attemptId})),
    );
    expect(await (await readAttempt()).json()).toEqual(first);
    expect(await (await readAttempt("7b1280e8-382a-4b7c-839b-839a7145c8bb")).json()).toEqual({ok:true,data:null});
    expect((await readAttempt("invalid")).status).toBe(400);
    ports.resolve.mockResolvedValue({...actor,userId:"unrelated-reader"});
    expect(await (await readAttempt()).json()).toEqual({ok:true,data:null});
    ports.resolve.mockResolvedValue(actor);
    expect((await read()).data.collectedAt).toBe(first.data.recordedAt);
    expect(await db.auditEvent.count({where:{organizationId,subjectId:incidentId,kind:"deployment_incident.evidence_collected"}})).toBe(1);
    expect((await submit({runId:"18"})).status).toBe(409);
    await db.release.update({where:{id:baseline.id},data:{commitSha:"d".repeat(40)}});
    expect((await read()).data.collectedAt).toBeNull();
    await db.release.update({where:{id:baseline.id},data:{commitSha:baseline.commitSha}});
    expect((await read()).data.collectedAt).toBe(first.data.recordedAt);
    // Move the saved release during the final session check, after the
    // initial incident lookup. The returned checklist must use the new source.
    ports.resolve.mockResolvedValueOnce(actor).mockImplementationOnce(async () => {
      await db.release.update({where:{id:releaseId},data:{commitSha:"c".repeat(40)}});
      return actor;
    });
    expect((await read()).data.collectedAt).toBeNull();
    expect(await (await submit()).json()).toEqual(first);
    expect(await (await readAttempt()).json()).toEqual(first);
    await db.orgMembership.update({where:{userId_organizationId:{userId:actor.userId,organizationId}},data:{role:"read_only"}});
    expect((await submit()).status).toBe(403);
    expect(await db.deploymentIncident.findUnique({where:{id:incidentId}})).toMatchObject({status:"open",updatedAt:incident.updatedAt});
  } finally {
    await db.$disconnect();
    ports.db = null;
  }
});
