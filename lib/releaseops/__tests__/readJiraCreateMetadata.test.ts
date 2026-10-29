import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({findUnique:vi.fn(),decrypt:vi.fn(),fetch:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({prisma:{tenantIntegrationConnection:{findUnique:mocks.findUnique}}}));
vi.mock("@/lib/security/credentialVault",()=>({decryptScopedCredential:mocks.decrypt}));
import {readJiraCreateMetadata} from "../readJiraCreateMetadata";
const connection=()=>({id:"jira-connection",organizationId:"org-1",status:"active",revokedAt:null,updatedAt:new Date("2026-10-24T00:00:00Z"),encryptedCredential:"opaque",scopesJson:["read:jira-work"]});
const field=(id="summary")=>({fieldId:id,name:"Summary",required:true,hasDefaultValue:false,operations:["set"],schema:{type:"string"}});
const page=(fields=[field()],startAt=0,total=fields.length)=>({startAt,maxResults:50,total,fields});
const input=()=>({organizationId:"org-1",projectIdOrKey:"KAN",issueTypeId:"10009",signal:new AbortController().signal});
const credential=()=>({cloudId:"01234567-89ab-4cde-8fab-0123456789ab",accessToken:"private-test-token",expiresAt:Date.now()+60_000});
beforeEach(()=>{vi.resetAllMocks();mocks.findUnique.mockImplementation(async()=>connection());mocks.decrypt.mockImplementation(()=>JSON.stringify(credential()));mocks.fetch.mockImplementation(async()=>new Response(JSON.stringify(page()),{headers:{"content-type":"application/json"}}));vi.stubGlobal("fetch",mocks.fetch)});
describe("tenant-scoped Jira create-field read",()=>{
 it("uses exact tenant and fixed Jira Cloud destination with no token in result",async()=>{
  const result=await readJiraCreateMetadata(input());expect(result.ok).toBe(true);
  expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId_provider:{organizationId:"org-1",provider:"jira"}}}));
  expect(mocks.decrypt).toHaveBeenCalledWith("opaque","tenant-integration-credential-v1:org-1:jira:jira-connection");
  expect(mocks.fetch).toHaveBeenCalledWith("https://api.atlassian.com/ex/jira/01234567-89ab-4cde-8fab-0123456789ab/rest/api/3/issue/createmeta/KAN/issuetypes/10009?startAt=0&maxResults=50",expect.objectContaining({method:"GET",redirect:"error",credentials:"omit",cache:"no-store",headers:expect.objectContaining({authorization:"Bearer private-test-token"})}));
  expect(JSON.stringify(result)).not.toContain("private-test-token");
 });
 it("collects every page before returning metadata",async()=>{
  mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(page([field()],0,2)))).mockResolvedValueOnce(new Response(JSON.stringify(page([field("description")],1,2))));
  const result=await readJiraCreateMetadata(input());expect(result.ok&&result.metadata.fields).toHaveLength(2);expect(mocks.fetch).toHaveBeenCalledTimes(2);
 });
 it.each(["missing","revoked","wrong-tenant","suspended","unscoped","expired"])("refuses %s connection before provider read",async(kind)=>{
  const row=connection();if(kind==="missing")mocks.findUnique.mockResolvedValue(null);
  if(kind==="revoked")mocks.findUnique.mockResolvedValue({...row,revokedAt:new Date()});
  if(kind==="wrong-tenant")mocks.findUnique.mockResolvedValue({...row,organizationId:"org-other"});
  if(kind==="suspended")mocks.findUnique.mockResolvedValue({...row,status:"suspended"});
  if(kind==="unscoped")mocks.findUnique.mockResolvedValue({...row,scopesJson:["write:jira-work"]});
  if(kind==="expired")mocks.decrypt.mockReturnValue(JSON.stringify({...credential(),expiresAt:Date.now()-1}));
  expect(await readJiraCreateMetadata(input())).toEqual({ok:false,error:"jira_create_metadata_unavailable"});expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it("refuses final connection revocation or revision changes",async()=>{
  mocks.findUnique.mockResolvedValueOnce(connection()).mockResolvedValueOnce({...connection(),updatedAt:new Date("2026-10-24T00:00:01Z")});
  expect((await readJiraCreateMetadata(input())).ok).toBe(false);
 });
 it("rejects inconsistent paging and bounds before more reads",async()=>{
  mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(page([field()],0,201))));
  expect((await readJiraCreateMetadata(input())).ok).toBe(false);expect(mocks.fetch).toHaveBeenCalledTimes(1);
 });
 it("refuses invalid target paths, arbitrary cloud hosts and aborts",async()=>{
  expect((await readJiraCreateMetadata({...input(),projectIdOrKey:"KAN/../../other"})).ok).toBe(false);
  mocks.decrypt.mockReturnValue(JSON.stringify({...credential(),cloudId:"https://evil.invalid"}));expect((await readJiraCreateMetadata(input())).ok).toBe(false);
  const controller=new AbortController();controller.abort();expect((await readJiraCreateMetadata({...input(),signal:controller.signal})).ok).toBe(false);expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it("rejects oversized/error bodies without reflecting provider errors",async()=>{
  mocks.fetch.mockResolvedValueOnce(new Response("private-provider-diagnostic",{status:403}));
  expect(await readJiraCreateMetadata(input())).toEqual({ok:false,error:"jira_create_metadata_unavailable"});
  mocks.fetch.mockResolvedValueOnce(new Response("x".repeat(256*1024+1)));
  expect((await readJiraCreateMetadata(input())).ok).toBe(false);
 });
 it("requires all granular read scopes without inferring consent from write scope",async()=>{
  mocks.findUnique.mockImplementation(async()=>({...connection(),scopesJson:["read:issue-meta:jira","read:avatar:jira","read:field-configuration:jira"]}));
  expect((await readJiraCreateMetadata(input())).ok).toBe(true);
  mocks.findUnique.mockImplementation(async()=>({...connection(),scopesJson:["read:issue-meta:jira"]}));
  mocks.fetch.mockClear();expect((await readJiraCreateMetadata(input())).ok).toBe(false);expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it("ends on caller cancellation even if fetch ignores abort",async()=>{
  const controller=new AbortController();mocks.fetch.mockImplementation(()=>new Promise(()=>undefined));
  const result=readJiraCreateMetadata({...input(),signal:controller.signal});
  await vi.waitFor(()=>expect(mocks.fetch).toHaveBeenCalledTimes(1));controller.abort();
  expect(await result).toEqual({ok:false,error:"jira_create_metadata_unavailable"});
 });
 it("cancels a stalled body read on caller abort",async()=>{
  const canceled=vi.fn();const controller=new AbortController();
  mocks.fetch.mockResolvedValue(new Response(new ReadableStream({start(stream){stream.enqueue(new TextEncoder().encode("{"))},cancel:canceled})));
  const result=readJiraCreateMetadata({...input(),signal:controller.signal});
  await vi.waitFor(()=>expect(mocks.fetch).toHaveBeenCalledTimes(1));controller.abort();
  expect((await result).ok).toBe(false);expect(canceled).toHaveBeenCalled();
 });
 it("refuses credential or scope replacement during a read",async()=>{
  mocks.findUnique.mockResolvedValueOnce(connection()).mockResolvedValueOnce({...connection(),encryptedCredential:"replaced"});
  expect((await readJiraCreateMetadata(input())).ok).toBe(false);
  mocks.findUnique.mockResolvedValueOnce(connection()).mockResolvedValueOnce({...connection(),scopesJson:[]});
  expect((await readJiraCreateMetadata(input())).ok).toBe(false);
 });

 it.each(["status", "length"])("cancels response bodies rejected by %s before streaming",async(kind)=>{
  const canceled=vi.fn();const body=new ReadableStream({start(stream){stream.enqueue(new Uint8Array([1]))},cancel:canceled});
  mocks.fetch.mockResolvedValue(new Response(body,kind==="status"?{status:403}:{headers:{"content-length":String(256*1024+1)}}));
  expect((await readJiraCreateMetadata(input())).ok).toBe(false);expect(canceled).toHaveBeenCalledTimes(1);
 });

 it("accepts an encrypted rotating refresh token without sending it to metadata APIs",async()=>{
  mocks.decrypt.mockReturnValue(JSON.stringify({...credential(),refreshToken:"private-rotating-refresh"}));
  const result=await readJiraCreateMetadata(input());expect(result.ok).toBe(true);expect(JSON.stringify(result)).not.toContain("private-rotating-refresh");
  expect(JSON.stringify(mocks.fetch.mock.calls)).not.toContain("private-rotating-refresh");
 });

 it("cancels a provider response arriving after caller cancellation",async()=>{
  let finish:(response:Response)=>void=()=>undefined;mocks.fetch.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve}));
  const controller=new AbortController();const result=readJiraCreateMetadata({...input(),signal:controller.signal});await vi.waitFor(()=>expect(mocks.fetch).toHaveBeenCalled());
  controller.abort();expect((await result).ok).toBe(false);const canceled=vi.fn();finish(new Response(new ReadableStream({cancel:canceled})));await vi.waitFor(()=>expect(canceled).toHaveBeenCalledTimes(1));
 });

});
