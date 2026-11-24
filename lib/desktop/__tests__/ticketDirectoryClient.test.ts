import {afterEach, expect, it, vi} from "vitest";
import {readIncidentRelease, readIncidentUpdates, readTicketDirectory, reportDeploymentIncident, saveIncidentUpdate} from "../../../desktop/src/lib/ticketDirectoryClient";
import {ticketDirectoryBodyLimit} from "../../tauri/ticketDirectoryContract";

const fixture = "https://fixture.invalid";
const token = "axm.desk.synthetic";
const body = {
  ok: true,
  data: {workspaceId: "fixture-workspace", actorId: "fixture-user", records: [],
    sources: {changes: {state: "available", limited: false}, incidents: {state: "available", limited: false}}},
};

afterEach(() => {vi.unstubAllGlobals();vi.useRealTimers();});

it("uses only the fixed GET path and paired bearer, omits cookies and rejects redirects", async () => {
  const wire = vi.fn().mockResolvedValue(Response.json(body));
  vi.stubGlobal("fetch", wire);
  expect(await readTicketDirectory(fixture, token, new AbortController().signal)).toEqual(body.data);
  expect(wire).toHaveBeenCalledWith(fixture + "/api/desktop/tickets", expect.objectContaining({
    method: "GET", credentials: "omit", redirect: "error", cache: "no-store",
    headers: {Authorization: "Bearer " + token},
  }));
  await readTicketDirectory(fixture, "vxlk_synthetic", new AbortController().signal);
  expect(wire).toHaveBeenCalledTimes(1);
});

it("refuses oversized replies before parsing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(" ".repeat(ticketDirectoryBodyLimit + 1))));
  expect(await readTicketDirectory(fixture, token, new AbortController().signal)).toBeUndefined();
});

it("returns after a deadline even if the underlying transport never settles", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
  const pending = readTicketDirectory(fixture, token, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(15000);
  expect(await pending).toBeUndefined();
});

it("distinguishes a confirmed missing release from an unrelated route failure", async () => {
  const report = {workspaceId:"fixture-workspace",actorId:"fixture-user",releaseId:"release-1",
    attemptId:"b73f99f7-91e2-4e49-8cd1-63087cc65f58",severity:"high" as const,title:"Fixture incident",summary:""};
  const wire = vi.fn()
    .mockResolvedValueOnce(new Response("Not Found", {status:404}))
    .mockResolvedValueOnce(Response.json({ok:false,error:"incident_release_not_found"},{status:404}));
  vi.stubGlobal("fetch",wire);
  const signal = new AbortController().signal;
  expect(await reportDeploymentIncident(fixture,token,signal,report)).toBeUndefined();
  expect(await reportDeploymentIncident(fixture,token,signal,report)).toEqual({state:"missing_release"});
  expect(wire).toHaveBeenLastCalledWith(fixture + "/api/desktop/tickets/incident-report", expect.objectContaining({
    method:"POST",body:JSON.stringify(report),credentials:"omit",redirect:"error",
  }));
});

const updateScope = {workspaceId:"fixture-workspace",actorId:"fixture-user",incidentId:"incident-1",releaseId:"release-1"};
const evidence = {commit:"a".repeat(40),digest:"d".repeat(64)};

it("uses the old incident update read only when the service refuses the evidence flag", async () => {
  const list = {...updateScope, canWrite:true, limited:false, notes:[]};
  const wire = vi.fn()
    .mockResolvedValueOnce(Response.json({ok:false,error:"invalid_incident_update"},{status:400}))
    .mockResolvedValueOnce(Response.json({ok:true,data:list}))
    .mockResolvedValueOnce(Response.json({ok:false,error:"incident_update_permission_required"},{status:403}));
  vi.stubGlobal("fetch",wire);
  const signal = new AbortController().signal;
  const read = () => readIncidentUpdates(fixture,token,signal,updateScope.incidentId,updateScope.releaseId);
  expect(await read()).toEqual(list);
  expect(wire.mock.calls[0][0]).toContain("&includeEvidence=1");
  expect(wire.mock.calls[1][0]).not.toContain("includeEvidence");
  expect(await read()).toBeUndefined();
  expect(wire).toHaveBeenCalledTimes(3);
});

it("checks the receipt's evidence against what the user reviewed", async () => {
  const command = {...updateScope, attemptId:"b73f99f7-91e2-4e49-8cd1-63087cc65f58", body:"Reviewed.", evidence};
  const snapshot = {...evidence, generatedAt:"2026-11-23T10:00:00.000Z", branchCheckCount:0, changeTicketCount:0};
  const receipt = {...updateScope, attemptId:command.attemptId,
    note:{id:"update-1",body:command.body,recordedAt:snapshot.generatedAt,authoredByYou:true,evidence:snapshot}};
  const wire = vi.fn()
    .mockResolvedValueOnce(Response.json({ok:true,data:{...receipt,note:{...receipt.note,evidence:{...snapshot,digest:"e".repeat(64)}}}}))
    .mockResolvedValueOnce(Response.json({ok:false,error:"incident_update_evidence_changed"},{status:409}))
    .mockResolvedValueOnce(Response.json({ok:true,data:receipt},{status:201}));
  vi.stubGlobal("fetch",wire);
  const save = () => saveIncidentUpdate(fixture,token,new AbortController().signal,command);
  expect(await save()).toBeUndefined();
  expect(await save()).toEqual({state:"evidence_changed"});
  expect(await save()).toEqual(receipt);
});

it("falls back to legacy evidence and rejects a source response for a different commit", async () => {
  const base = {workspaceId:"fixture-workspace",actorId:"fixture-user",incidentId:"incident-1",incidentStatus:"open",
    release:{id:"release-1",status:"failed",tag:"v1.9.3",commit:"a".repeat(40)}};
  const wrong = {...base,sources:{state:"recorded",repository:"fixture-owner/inventory",commit:"b".repeat(40),limited:false,runs:[],comparison:null}};
  const wire = vi.fn().mockResolvedValueOnce(Response.json({ok:false,error:"invalid_ticket_directory_request"},{status:400}))
    .mockResolvedValueOnce(Response.json({ok:true,data:base})).mockResolvedValueOnce(Response.json({ok:true,data:wrong}));
  vi.stubGlobal("fetch",wire);
  const read = () => readIncidentRelease(fixture,token,new AbortController().signal,"incident-1","sources");
  expect(await read()).toEqual(base);
  expect(wire.mock.calls[0][0]).toContain("includeIncidentSources=1");
  expect(wire.mock.calls[1][0]).toContain("includeReleaseEvidence=1");
  expect(await read()).toBeUndefined();
  expect(wire).toHaveBeenCalledTimes(3);
});
