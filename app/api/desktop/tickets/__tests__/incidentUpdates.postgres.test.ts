import {statSync} from "node:fs";
import {createRequire} from "node:module";
import type {PrismaClient as Client} from "@/lib/prismaClient";
import {PrismaPg} from "@prisma/adapter-pg";
import {NextRequest} from "next/server";
import {expect, it, vi} from "vitest";
import {generateEvidencePack} from "@/lib/releaseops/evidencePackGenerator";
import {GET, POST} from "../incident-updates/route";

const ports = vi.hoisted(() => ({db: null as Client | null, resolve: vi.fn()}));
vi.mock("@/lib/db", () => ({get prisma() { return ports.db; }}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({resolveRequestDesktopSession: ports.resolve}));

// Use the generated client from this checkout, even when dependencies are shared.
const {PrismaClient} = createRequire(import.meta.url)("../../../../../lib/generated/prisma/client.js") as typeof import("@/lib/prismaClient");

const host = process.env.V19_INCIDENT_OWNED_SOCKET;
it.skipIf(!host)("saves one private update and audit event for concurrent retries in the exact incident scope", async () => {
  if (!host || !/^\/(?:private\/)?tmp\/v19-incident-owned-[^/]+\/socket$/.test(host)) throw Error("owned socket required");
  const socket = statSync(host);
  if (socket.uid !== process.getuid?.() || (socket.mode & 0o077) !== 0) throw Error("owned socket required");
  const db = new PrismaClient({adapter: new PrismaPg({host, user:"v19_incident_fixture", database:"postgres"})});
  try {
    const [identity] = await db.$queryRaw<{owned: boolean}[]>`SELECT current_user = 'v19_incident_fixture' AND current_setting('listen_addresses') = '' AS owned`;
    if (!identity?.owned) throw Error("owned socket required");
    const organizationId = "update-workspace";
    const incidentId = "update-incident";
    const releaseId = "update-release";
    const actor = {id:"update-session", userId:"update-user", organizationId, credentialKind:"desktop_session",
      role:"operator", capabilities:["workspace:read"]};
    ports.db = db;
    ports.resolve.mockResolvedValue(actor);
    await db.orgMembership.create({data:{organizationId,userId:actor.userId,role:"operator",acceptedAt:new Date()}});
    await db.desktopSessionRecord.create({data:{
      id:actor.id, userId:actor.userId, organizationId, deviceFingerprint:"synthetic", deviceLabel:"Fixture",
      platform:"macos", issuedAt:new Date(), lastSeenAt:new Date(), expiresAt:new Date(Date.now()+60000),
    }});
    await db.deploymentIncident.create({data:{
      id:incidentId,organizationId,releaseId,severity:"high",title:"Fixture incident",reportedByUserId:actor.userId,
    }});

    const path = "http://localhost/api/desktop/tickets/incident-updates";
    const command = {
      workspaceId:organizationId, actorId:actor.userId, incidentId, releaseId, body:"Confirm cache endpoint.",
      attemptId:"43fe1f13-e993-4ee8-87aa-3e28079330bf",
    };
    const submit = (changes = {}) => POST(new NextRequest(path,{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...command,...changes}),
    }));
    const list = (includeEvidence = false) => GET(new NextRequest(
      path+`?incidentId=${incidentId}&releaseId=${releaseId}`+(includeEvidence ? "&includeEvidence=1" : ""),
    ));
    expect(await (await list()).json()).toMatchObject({ok:true,data:{canWrite:true,notes:[]}});
    expect((await submit({releaseId:"unrelated-release"})).status).toBe(404);
    expect((await submit({workspaceId:"other-workspace"})).status).toBe(403);
    const writes = await Promise.all([submit(), submit()]);
    expect(writes.map(response => response.status).sort()).toEqual([200,201]);
    const [{data:first},{data:second}] = await Promise.all(writes.map(response => response.json()));
    expect(first).toEqual(second);
    expect(await db.deploymentIncidentUpdate.count({where:{organizationId,incidentId,releaseId}})).toBe(1);
    const audit = await db.auditEvent.findMany({where:{organizationId,kind:"deployment_incident.update_added"}});
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(command.body);
    expect((await (await list()).json()).data.notes).toEqual([first.note]);
    expect((await submit({body:"Different body."})).status).toBe(409);

    const release = await db.release.create({data:{
      id:releaseId, organizationId, applicationId:"fixture-app", releaseTag:"v1.9.3", commitSha:"a".repeat(40),
    }});
    const pack = (now: Date) => {
      const {content,contentHash} = generateEvidencePack({
        release, repository:null, latestReadiness:null, prs:[], cherryPicks:[], linkedTickets:[], branchChecks:[],
      },{now});
      return {contentHash,contentJson:JSON.parse(JSON.stringify(content))};
    };
    const now = new Date("2026-11-23T10:00:00.000Z");
    const original = pack(now);
    const snapshot = {
      commit:release.commitSha,digest:original.contentHash,generatedAt:now.toISOString(),branchCheckCount:0,changeTicketCount:0,
    };
    await db.releaseEvidencePack.create({data:{organizationId, releaseId, ...original}});
    expect((await (await list(true)).json()).data.attachableEvidence).toEqual(snapshot);
    const changes = {
      attemptId:"812ac961-02f6-41b4-8e46-10cd87e696fb",
      evidence:{commit:release.commitSha,digest:original.contentHash},
    };
    const attached = await submit(changes);
    expect(attached.status).toBe(201);
    const {data:attachedData} = await attached.json();
    expect(attachedData.note.evidence).toEqual(snapshot);
    const legacy = (await (await list()).json()).data;
    expect(legacy).not.toHaveProperty("attachableEvidence");
    expect(legacy.notes.find((note: {id: string}) => note.id === attachedData.note.id)).not.toHaveProperty("evidence");

    const refreshed = pack(new Date("2026-11-23T10:01:00.000Z"));
    await db.releaseEvidencePack.update({where:{releaseId},data:refreshed});
    const stale = await submit({...changes, attemptId:"3d43158f-c7f1-4265-9ebc-1c24f0a56701"});
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ok:false,error:"incident_update_evidence_changed"});
    const replay = await submit(changes);
    expect(replay.status).toBe(200);
    expect((await replay.json()).data).toEqual(attachedData);
    expect((await submit({...changes,evidence:{...changes.evidence,digest:refreshed.contentHash}})).status).toBe(409);
    expect(await db.deploymentIncidentUpdate.count({where:{organizationId,incidentId,releaseId}})).toBe(2);
    expect(await db.auditEvent.count({where:{organizationId,kind:"deployment_incident.update_added"}})).toBe(2);

    await db.orgMembership.update({where:{userId_organizationId:{userId:actor.userId,organizationId}},data:{role:"read_only"}});
    expect((await submit()).status).toBe(403);
    ports.resolve.mockResolvedValue({...actor,role:"read_only"});
    const readOnly = (await (await list(true)).json()).data;
    expect(readOnly).toMatchObject({canWrite:false,attachableEvidence:null});
    expect(readOnly.notes).toContainEqual(first.note);
    expect(readOnly.notes).toContainEqual(attachedData.note);
    ports.resolve.mockResolvedValue({...actor,organizationId:"other-workspace"});
    expect((await list()).status).toBe(404);
  } finally {
    await db.$disconnect();
    ports.db = null;
  }
});
