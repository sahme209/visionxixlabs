import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
const io = vi.hoisted(() => ({ lookup: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tenantIntegrationConnection: { findUnique: io.lookup, findFirst: io.find, updateMany: io.update } } }));
import { readJiraTicketChoices } from "../readJiraTicketChoices";
const NOW = Date.parse("2026-10-24T18:20:00.000Z"), cloudId = "12345678-1234-4234-8234-123456789abc";
const tokenUrl = "https://auth.atlassian.com/oauth/token", metaUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search?startAt=0&maxResults=20`;
const actor = { organizationId: "tenant", userId: "consenter", canManageConnections: true };
const context = connectionCredentialContext({ organizationId: "tenant", provider: "jira", connectionId: "connection" });
function fixture(expired = true) {
 const token = { accessToken: "OLD_ACCESS", refreshToken: "OLD_REFRESH", expiresAt: NOW + (expired ? -1 : 3600000), cloudId };
 const row = { id: "connection", organizationId: "tenant", provider: "jira", status: "active", revokedAt: null as Date | null, consentedByUserId: "consenter", externalAccountId: cloudId,
  scopesJson: ["read:jira-work", "offline_access"], updatedAt: new Date(NOW - 1000), lastValidatedAt: new Date(NOW - 2000), encryptedCredential: encryptScopedCredential(JSON.stringify(token), context) };
 const copy = () => ({ ...row, scopesJson: [...row.scopesJson] }); io.lookup.mockImplementation(async () => copy()); io.find.mockImplementation(async () => copy());
 io.update.mockImplementation(async ({ where, data }) => {
  const match = Object.entries(where).every(([key,value]) => key === "scopesJson" ? JSON.stringify(row.scopesJson) === JSON.stringify((value as {equals:unknown}).equals) : value instanceof Date ? (row[key as "updatedAt"] as Date).getTime() === value.getTime() : row[key as "id"] === value);
  if (!match) return { count: 0 }; Object.assign(row, data); return { count: 1 };
 });
 const authority = vi.fn(async () => actor);
 const transport = vi.fn<typeof fetch>(async (address, init) => {
  if (String(address) === tokenUrl) { expect(init?.method).toBe("POST"); return Response.json({ access_token: "NEW_ACCESS", refresh_token: "NEW_REFRESH", expires_in: 3600, scope: "read:jira-work offline_access" }); }
  expect(String(address)).toBe(metaUrl); expect(init?.method).toBe("GET");
  return Response.json({ startAt: 0, maxResults: 20, total: 1, isLast:true, values: [{ id:"100",key:"KAN",name:"Kanban" }] });
 });
 vi.stubGlobal("fetch", transport);
 const authorization = { actor, readCurrentActor: authority, connectionId: "connection", revision: row.updatedAt.toISOString(), refresh: { clientId: "client", clientSecret: "SYNTHETIC_APP_SECRET", transport } };
 const input = { organizationId: "tenant", mode: "projects" as const, startAt: 0, signal: new AbortController().signal, authorization };
 return { row, token, transport, authority, input };
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-metadata-refresh-test-vault-key"); vi.spyOn(Date, "now").mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("refreshes only expired authorized storage, then reads metadata with the durably rotated access token", async () => {
 const f = fixture(); const oldHealth = f.row.lastValidatedAt;
 expect(await readJiraTicketChoices(f.input)).toMatchObject({ ok: true, connectionId: "connection", connectionRevision: new Date(NOW).toISOString(), choices: { authority: "discovery_only", rows: [{ id: "100",name:"Kanban" }],hasMore:false,nextStartAt:null } });
 expect(f.transport.mock.calls.map(call => [String(call[0]), call[1]?.method])).toEqual([[tokenUrl,"POST"],[metaUrl,"GET"]]);
 expect(f.transport.mock.calls[1][1]?.headers).toMatchObject({ authorization: "Bearer NEW_ACCESS" }); expect(io.update).toHaveBeenCalledTimes(3); expect(f.row.lastValidatedAt).toEqual(oldHealth);
 expect(JSON.parse(decryptScopedCredential(f.row.encryptedCredential, context)).refreshToken).toBe("NEW_REFRESH");
});
it("unexpired authorized reads never call token refresh or mutate storage", async () => {
 const f = fixture(false); expect((await readJiraTicketChoices(f.input)).ok).toBe(true); expect(io.update).not.toHaveBeenCalled(); expect(f.transport).toHaveBeenCalledTimes(1); expect(String(f.transport.mock.calls[0][0])).toBe(metaUrl);
});
it("legacy expired reads without explicit consenting authority remain unavailable", async () => {
 const f = fixture(); const {authorization:_authorization,...input}=f.input; expect((await readJiraTicketChoices(input)).ok).toBe(false); expect(io.update).not.toHaveBeenCalled(); expect(f.transport).not.toHaveBeenCalled();
});
it.each(["viewer", "other_admin", "tenant", "connection", "revision", "site"])("refuses mismatched %s without any provider call", async change => {
 const f = fixture();
 if (change === "viewer") f.input.authorization.actor = { ...actor, canManageConnections: false };
 if (change === "other_admin") { f.input.authorization.actor = { ...actor, userId: "other" }; f.authority.mockResolvedValue({ ...actor, userId: "other" }); }
 if (change === "tenant") f.input.authorization.actor = { ...actor, organizationId: "foreign" };
 if (change === "connection") f.input.authorization.connectionId = "foreign";
 if (change === "revision") f.input.authorization.revision = new Date(NOW - 500).toISOString();
 if (change === "site") f.row.externalAccountId = "22345678-1234-4234-8234-123456789abc";
 expect((await readJiraTicketChoices(f.input)).ok).toBe(false); expect(f.transport).not.toHaveBeenCalled(); expect(io.update).not.toHaveBeenCalled();
});
it("only one concurrent expired reader rotates and reaches metadata", async () => {
 const f = fixture(); const results = await Promise.all([readJiraTicketChoices(f.input),readJiraTicketChoices(f.input)]);
 expect(results.filter(result => result.ok)).toHaveLength(1); expect(f.transport.mock.calls.filter(call => String(call[0]) === tokenUrl)).toHaveLength(1);
 expect(f.transport.mock.calls.filter(call => String(call[0]) === metaUrl)).toHaveLength(1);
});
it("unknown rotation outcome returns no-retry metadata refusal and performs no GET", async () => {
 const f = fixture(); f.transport.mockRejectedValue(new Error("SYNTHETIC_LOST_RESPONSE"));
 expect(await readJiraTicketChoices(f.input)).toEqual({ ok: false, error: "jira_refresh_persistence_outcome_unknown", retryAllowed: false });
 expect(f.transport).toHaveBeenCalledTimes(1); expect(f.row.status).toBe("needs_attention");
});
it("revoked consenter after refresh cannot receive metadata or trigger another request", async () => {
 const f = fixture(); const original = f.transport.getMockImplementation()!;
 f.transport.mockImplementation(async (address,init) => { const result=await original(address,init); if(String(address)===tokenUrl)f.authority.mockResolvedValue({ ...actor, canManageConnections:false }); return result; });
 expect((await readJiraTicketChoices(f.input)).ok).toBe(false); expect(f.transport.mock.calls.filter(call=>String(call[0])===metaUrl)).toHaveLength(0);
});
it("rechecks actor after final metadata row read before returning discovery", async () => {
 const f=fixture(false); let lookups=0; io.lookup.mockImplementation(async()=>{ if(++lookups===2)f.authority.mockResolvedValue({ ...actor, canManageConnections:false }); return { ...f.row }; });
 expect((await readJiraTicketChoices(f.input)).ok).toBe(false);
});
it("does not switch sites if the post-refresh reload replaces both stored site and encrypted cloud identity", async () => {
 const f=fixture(); let lookups=0;
 io.lookup.mockImplementation(async()=>{
  if(++lookups===2){
   const cloudId="22345678-1234-4234-8234-123456789abc";
   f.row.externalAccountId=cloudId;
   f.row.encryptedCredential=encryptScopedCredential(JSON.stringify({accessToken:"REPLACED_ACCESS",refreshToken:"REPLACED_REFRESH",expiresAt:NOW+3600000,cloudId}),context);
  }
  return {...f.row};
 });
 const original=f.transport.getMockImplementation()!;
 f.transport.mockImplementation(async(address,init)=>String(address)===tokenUrl ? original(address,init) : Response.json({startAt:0,maxResults:50,total:0,fields:[]}));
 expect((await readJiraTicketChoices(f.input)).ok).toBe(false);
 expect(f.transport.mock.calls.filter(call=>String(call[0])!==tokenUrl)).toHaveLength(0);
});

it("returns truthful one-page continuation without draining catalog",async()=>{const f=fixture(false);f.transport.mockResolvedValue(Response.json({startAt:0,maxResults:20,total:2,isLast:false,values:[{id:"1",key:"ONE",name:"One"}]}));expect(await readJiraTicketChoices(f.input)).toMatchObject({ok:true,choices:{hasMore:true,nextStartAt:1,limitReached:false}});expect(f.transport).toHaveBeenCalledTimes(1);});
it("reads exact selected project issue-type choices",async()=>{const f=fixture(false);f.transport.mockResolvedValue(Response.json({startAt:0,maxResults:20,total:1,issueTypes:[{id:"9",name:"Task",subtask:false}]}));expect(await readJiraTicketChoices({...f.input,mode:"issueTypes",projectIdOrKey:"KAN"})).toMatchObject({ok:true,choices:{rows:[{id:"9",name:"Task",subtask:false}]}});expect(String(f.transport.mock.calls[0][0])).toContain("/issue/createmeta/KAN/issuetypes?startAt=0&maxResults=20");});
it.each([{startAt:0,maxResults:20,total:1,isLast:true,values:[]},{startAt:1,maxResults:20,total:1,values:[]},{startAt:0,maxResults:20,total:2,isLast:true,values:[{id:"1",key:"ONE",name:"One"}]},{startAt:0,maxResults:20,total:1,values:[{id:"bad",key:"ONE",name:"One"}]}])("rejects inconsistent provider page %j",async page=>{const f=fixture(false);f.transport.mockResolvedValue(Response.json(page));expect((await readJiraTicketChoices(f.input)).ok).toBe(false);});
it("reports catalog traversal cap honestly",async()=>{const f=fixture(false);f.transport.mockResolvedValue(Response.json({startAt:200,maxResults:20,total:222,isLast:false,values:[{id:"1",key:"ONE",name:"One"}]}));expect(await readJiraTicketChoices({...f.input,startAt:200})).toMatchObject({ok:true,choices:{hasMore:true,nextStartAt:null,limitReached:true}});});
it("never refreshes on provider401",async()=>{const f=fixture(false);f.transport.mockResolvedValue(new Response(null,{status:401}));expect((await readJiraTicketChoices(f.input)).ok).toBe(false);expect(f.transport).toHaveBeenCalledTimes(1);expect(io.update).not.toHaveBeenCalled();});
it.each([{startAt:-1},{startAt:201},{query:'☃'.repeat(34)},{query:'bad\nquery'},{mode:'issueTypes',projectIdOrKey:'KAN',query:'x'}])('rejects bounded caller input %j before provider IO',async change=>{const f=fixture(false);expect((await readJiraTicketChoices({...f.input,...change} as Parameters<typeof readJiraTicketChoices>[0])).ok).toBe(false);expect(f.transport).not.toHaveBeenCalled();expect(io.update).not.toHaveBeenCalled();});
it('bounds provider bytes before decoding',async()=>{const f=fixture(false);f.transport.mockResolvedValue(new Response('x',{headers:{'content-type':'application/json','content-length':String(256*1024+1)}}));expect((await readJiraTicketChoices(f.input)).ok).toBe(false);});
it('rejects nonJSON provider content',async()=>{const f=fixture(false);f.transport.mockResolvedValue(new Response('{}',{headers:{'content-type':'text/html'}}));expect((await readJiraTicketChoices(f.input)).ok).toBe(false);});
it('cancels hanging provider read without retry',async()=>{const f=fixture(false);f.transport.mockImplementation(()=>new Promise(()=>undefined));const controller=new AbortController();const pending=readJiraTicketChoices({...f.input,signal:controller.signal});await vi.waitFor(()=>expect(f.transport).toHaveBeenCalledTimes(1));controller.abort();expect((await pending).ok).toBe(false);expect(io.update).not.toHaveBeenCalled();});
it('refuses final connection revision changes after catalog IO',async()=>{const f=fixture(false);let reads=0;io.lookup.mockImplementation(async()=>({...f.row,updatedAt:++reads===2?new Date(NOW+1):f.row.updatedAt}));expect((await readJiraTicketChoices(f.input)).ok).toBe(false);});
it('keeps complete Unicode choice names and exact IDs',async()=>{const f=fixture(false);const name='工单 🌍';f.transport.mockResolvedValue(Response.json({startAt:0,maxResults:20,total:1,isLast:true,values:[{id:'12345678901234567890',key:'UNICODE',name}]}));expect(await readJiraTicketChoices(f.input)).toMatchObject({ok:true,choices:{rows:[{id:'12345678901234567890',name}]}});});
it('allows an already recorded write scope only for the existing unexpired read choices operation',async()=>{const f=fixture(false);f.row.scopesJson.push('write:jira-work');expect((await readJiraTicketChoices(f.input)).ok).toBe(true);expect(f.transport).toHaveBeenCalledTimes(1);expect(f.transport.mock.calls[0][1]?.method).toBe('GET');expect(io.update).not.toHaveBeenCalled()});
