import {statSync} from "node:fs";
import {createRequire} from "node:module";
import type {PrismaClient as Client} from "@/lib/prismaClient";
import {PrismaPg} from "@prisma/adapter-pg";
import {NextRequest} from "next/server";
import {expect, it, vi} from "vitest";
import {POST} from "../incident-transition/route";

const ports = vi.hoisted(() => ({db: null as Client | null, resolve: vi.fn()}));
vi.mock("@/lib/db", () => ({get prisma() { return ports.db; }}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({resolveRequestDesktopSession: ports.resolve}));

// Use the generated client from this checkout, even when dependencies are shared.
const {PrismaClient} = createRequire(import.meta.url)("../../../../../lib/generated/prisma/client.js") as typeof import("@/lib/prismaClient");

const host = process.env.V19_INCIDENT_OWNED_SOCKET;
it.skipIf(!host)("serializes incident status changes and replays the original audit receipt", async () => {
  if (!host || !/^\/(?:private\/)?tmp\/v19-incident-owned-[^/]+\/socket$/.test(host)) throw Error("owned socket required");
  const socket = statSync(host);
  if (socket.uid !== process.getuid?.() || (socket.mode & 0o077) !== 0) throw Error("owned socket required");
  const db = new PrismaClient({adapter: new PrismaPg({host, user:"v19_incident_fixture", database:"postgres"})});
  try {
    const [identity] = await db.$queryRaw<{owned: boolean}[]>`SELECT current_user = 'v19_incident_fixture' AND current_setting('listen_addresses') = '' AS owned`;
    if (!identity?.owned) throw Error("owned socket required");
    const organizationId = "transition-workspace";
    const incidentId = "transition-incident";
    const releaseId = "transition-release";
    const actor = {id:"transition-session", userId:"transition-user", organizationId, credentialKind:"desktop_session",
      role:"operator", capabilities:["workspace:read"]};
    ports.db = db;
    ports.resolve.mockResolvedValue(actor);
    await db.orgMembership.create({data:{organizationId,userId:actor.userId,role:"operator",acceptedAt:new Date()}});
    await db.desktopSessionRecord.create({data:{
      id:actor.id, userId:actor.userId, organizationId, deviceFingerprint:"synthetic", deviceLabel:"Fixture",
      platform:"macos", issuedAt:new Date(), lastSeenAt:new Date(), expiresAt:new Date(Date.now()+60000),
    }});
    await db.release.create({data:{id:releaseId,organizationId,applicationId:"fixture-app"}});
    const incident = await db.deploymentIncident.create({data:{
      id:incidentId,organizationId,releaseId,severity:"high",title:"Fixture incident",reportedByUserId:actor.userId,
    }});


    const target = "http://localhost/api/desktop/tickets/incident-transition";
    const command = {
      workspaceId:organizationId,actorId:actor.userId,incidentId,releaseId,action:"mitigate",previousStatus:"open",
      expectedRevision:incident.updatedAt.toISOString(),attemptId:"43fe1f13-e993-4ee8-87aa-3e28079330bf",
    };
    const submit = (changes = {}) => POST(new NextRequest(target,{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...command,...changes}),
    }));
    expect((await submit({workspaceId:"other-workspace"})).status).toBe(403);
    expect((await submit({releaseId:"other-release"})).status).toBe(404);
    expect((await submit({action:"reopen"})).status).toBe(422);
    const responses = await Promise.all([submit(),submit()]);
    expect(responses.map(row => row.status)).toEqual([200,200]);
    const [first,replay] = await Promise.all(responses.map(row => row.json()));
    expect(first).toEqual(replay);
    expect(first.data.status).toBe("mitigated");
    expect(await db.auditEvent.count({where:{organizationId,subjectId:incidentId}})).toBe(1);
    expect((await submit({action:"resolve"})).status).toBe(409);

    const reopened = await submit({action:"reopen",previousStatus:"mitigated",expectedRevision:first.data.revision,
      attemptId:"df4574c9-f48a-4a5b-b31a-7df5945b8b4d"});
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).data.status).toBe("open");
    const stale = await submit({attemptId:"fb33f94d-0a3c-42ee-bbd2-98edd2ac13e5"});
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({error:"incident_transition_changed"});
    expect(await (await submit()).json()).toEqual(first);
    expect(await db.auditEvent.count({where:{organizationId,subjectId:incidentId}})).toBe(2);
    expect(await db.deploymentIncident.findUnique({where:{id:incidentId}})).toMatchObject({status:"open",mitigatedAt:null});

    await db.orgMembership.update({where:{userId_organizationId:{userId:actor.userId,organizationId}},data:{role:"security_reviewer"}});
    expect((await submit()).status).toBe(403);
  } finally {
    await db.$disconnect();
    ports.db = null;
  }
});
