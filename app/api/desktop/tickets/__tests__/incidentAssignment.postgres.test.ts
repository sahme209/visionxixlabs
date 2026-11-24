import {statSync} from "node:fs";
import {createRequire} from "node:module";
import type {PrismaClient as Client} from "@/lib/prismaClient";
import {PrismaPg} from "@prisma/adapter-pg";
import {NextRequest} from "next/server";
import {expect, it, vi} from "vitest";
import {GET,POST} from "../incident-assignment/route";
import {GET as directory} from "../route";

const ports = vi.hoisted(() => ({db: null as Client | null, resolve: vi.fn()}));
vi.mock("@/lib/db", () => ({get prisma() { return ports.db; }}));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({resolveRequestDesktopSession: ports.resolve}));

// Use the generated client from this checkout, even when dependencies are shared.
const {PrismaClient} = createRequire(import.meta.url)("../../../../../lib/generated/prisma/client.js") as typeof import("@/lib/prismaClient");

const host = process.env.V19_INCIDENT_OWNED_SOCKET;
it.skipIf(!host)("binds owner changes to accepted members and preserves the incident revision", async () => {
  if (!host || !/^\/(?:private\/)?tmp\/v19-incident-owned-[^/]+\/socket$/.test(host)) throw Error("owned socket required");
  const socket = statSync(host);
  if (socket.uid !== process.getuid?.() || (socket.mode & 0o077) !== 0) throw Error("owned socket required");
  const db = new PrismaClient({adapter: new PrismaPg({host, user:"v19_incident_fixture", database:"postgres"})});
  try {
    const [identity] = await db.$queryRaw<{owned: boolean}[]>`SELECT current_user = 'v19_incident_fixture' AND current_setting('listen_addresses') = '' AS owned`;
    if (!identity?.owned) throw Error("owned socket required");
    const organizationId = "assignment-workspace";
    const incidentId = "assignment-incident";
    const releaseId = "assignment-release";
    const actor = {id:"assignment-session", userId:"assignment-user", organizationId, credentialKind:"desktop_session",
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



    const owner = "assignment-target";
    await db.orgMembership.createMany({data:[
      {organizationId,userId:owner,role:"operator",acceptedAt:new Date()},
      {organizationId,userId:"unaccepted",role:"operator"},
      {organizationId:"another-org",userId:"foreign",role:"operator",acceptedAt:new Date()},
      {organizationId,userId:"viewer",role:"read_only",acceptedAt:new Date()},
    ]});
    const url = "http://localhost/api/desktop/tickets/incident-assignment";
    const options = async () => (await GET(new NextRequest(url+`?incidentId=${incidentId}`))).json();
    const command = {
      workspaceId:organizationId,actorId:actor.userId,incidentId,releaseId,incidentRevision:incident.updatedAt.toISOString(),
      ownerUserId:owner,expectedAssignmentRevision:null,attemptId:"bfae3e76-aa99-457c-8856-4a96689ba115",
    };
    const submit = (changes = {}) => POST(new NextRequest(url,{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...command,...changes}),
    }));
    expect((await options()).data.candidates.map((member: {userId:string}) => member.userId).sort()).toEqual([actor.userId,owner].sort());
    for (const ownerUserId of ["unaccepted","foreign","viewer"]) {
      expect((await submit({ownerUserId})).status).toBe(409);
    }
    const replies = await Promise.all([submit(),submit()]);
    expect(replies.map(reply => reply.status)).toEqual([200,200]);
    const [first,replay] = await Promise.all(replies.map(reply => reply.json()));
    expect(first).toEqual(replay);
    expect((await options()).data.assignmentRevision).toBe(first.data.assignmentRevision);
    const ownerView = async () => {
      const response = await directory(new NextRequest("http://localhost/api/desktop/tickets"));
      return (await response.json()).data.records.find((row: {id:string}) => row.id === incidentId).owner;
    };
    expect(await ownerView()).toMatchObject({state:"assigned",userId:owner});
    expect((await submit({attemptId:"347e45b4-0780-4660-88a2-ddc026c14c1f",ownerUserId:null})).status).toBe(409);
    await db.orgMembership.delete({where:{userId_organizationId:{userId:owner,organizationId}}});
    expect(await ownerView()).toEqual({state:"unavailable"});
    expect(await (await submit()).json()).toEqual(first);
    const cleared = await submit({attemptId:"347e45b4-0780-4660-88a2-ddc026c14c1f",ownerUserId:null,
      expectedAssignmentRevision:first.data.assignmentRevision});
    expect(cleared.status).toBe(200);
    expect(await ownerView()).toEqual({state:"unassigned"});
    expect(await db.deploymentIncident.findUnique({where:{id:incidentId}})).toMatchObject({status:"open",updatedAt:incident.updatedAt});
    expect(await db.auditEvent.count({where:{organizationId,subjectId:incidentId,kind:"deployment_incident.owner_changed"}})).toBe(2);
  } finally {
    await db.$disconnect();
    ports.db = null;
  }
});
