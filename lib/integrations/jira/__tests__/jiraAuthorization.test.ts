import { describe, expect, it } from "vitest";
import { beginJiraAuthorization, consumeJiraAuthorization } from "../jiraAuthorization";
import type { AuthorizationAttemptRow, TenantConnectionRepo } from "../../tenantConnectionRepo";
function store() {
 const rows: AuthorizationAttemptRow[] = [];
 const repo: TenantConnectionRepo = { tenantIntegrationAuthorizationAttempt: {
  create: async ({data}) => { const row = {...data,id:"attempt",consumedAt:null}; rows.push(row); return row; },
  findUnique: async ({where}) => rows.find(r=>r.stateDigest===where.stateDigest)??null,
  updateMany: async ({where,data}) => {const r=rows.find(r=>r.id===where.id&&r.consumedAt===null&&r.expiresAt>where.expiresAt.gt); if(!r)return {count:0};r.consumedAt=data.consumedAt;return {count:1};}
 }}; return {repo,rows};
}
const actor={organizationId:"org-a",userId:"user-a",canManageConnections:true};
const config={clientId:"platform-app",redirectUri:"https://axiom.test/api/integrations/jira/callback"};
describe("Jira workspace-bound consent",()=>{
 it("persists only a digest and creates a read-only consent URL without advertising a connection",async()=>{
  const {repo,rows}=store();const result=await beginJiraAuthorization(repo,{actor,...config});
  const url=new URL(result.consentUrl);expect(url.searchParams.get("scope")).toBe("read:jira-work offline_access");
  expect(rows).toHaveLength(1);expect(rows[0].provider).toBe("jira");expect(rows[0].stateDigest).not.toBe(url.searchParams.get("state"));expect(rows[0].encryptedPkceVerifier).toBeNull();
 });
 it.each([null,{...actor,canManageConnections:false},{...actor,userId:""}])("refuses an unauthorized initiator before creating state",async bad=>{
  const {repo,rows}=store();await expect(beginJiraAuthorization(repo,{actor:bad,...config})).rejects.toThrow("jira_authorization_unavailable");expect(rows).toHaveLength(0);
 });
 it("refuses invalid configuration without leaving an authorization attempt",async()=>{
  const {repo,rows}=store();await expect(beginJiraAuthorization(repo,{actor,...config,redirectUri:"http://evil.test/callback"})).rejects.toThrow();expect(rows).toHaveLength(0);
 });
 it("binds callback to current tenant, user and permission without consuming a valid challenge on mismatch",async()=>{
  const {repo}=store();const start=await beginJiraAuthorization(repo,{actor,...config});const state=new URL(start.consentUrl).searchParams.get("state")!;
  for(const wrong of [{...actor,organizationId:"org-b"},{...actor,userId:"other"},{...actor,canManageConnections:false}])
   expect(await consumeJiraAuthorization(repo,{actor:wrong,state,redirectUri:config.redirectUri})).toEqual({ok:false});
  const results=await Promise.all([1,2].map(()=>consumeJiraAuthorization(repo,{actor,state,redirectUri:config.redirectUri})));
  expect(results.filter(r=>r.ok)).toHaveLength(1);
 });
 it("refuses a different callback and an expired state",async()=>{
  const {repo}=store();const now=new Date("2026-10-24T12:00:00Z");const start=await beginJiraAuthorization(repo,{actor,...config,now});const state=new URL(start.consentUrl).searchParams.get("state")!;
  expect(await consumeJiraAuthorization(repo,{actor,state,redirectUri:"https://other.test/api/integrations/jira/callback",now})).toEqual({ok:false});
  expect(await consumeJiraAuthorization(repo,{actor,state,redirectUri:config.redirectUri,now:new Date("2026-10-24T12:11:00Z")})).toEqual({ok:false});
 });
});
