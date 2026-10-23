import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state=vi.hoisted(()=>({roles:["security_reviewer"],stable:true,effects:[] as string[]}));
vi.mock("@/lib/auth/currentContext",()=>{
 const context=async()=>({isAuthenticated:true,userId:"user-reviewer",sessionUserId:state.stable?"user-reviewer":undefined,organizationId:"ws_shared",email:"reviewer@example.test",roles:state.roles});
 return {currentContext:context,requireContext:context};
});
vi.mock("@/lib/workforce/domains/integrationRegistry",async importOriginal=>{
 const actual=await importOriginal<typeof import("@/lib/workforce/domains/integrationRegistry")>();
 return {...actual,readIntegrationConfig:async()=>({github:null,slackActions:null,linear:null}),writeIntegrationConfig:async()=>{state.effects.push("config-written");}};
});
vi.mock("@/lib/workforce/domains/actionExecutor",()=>({dispatchAction:async()=>{state.effects.push("external-action");return {executionSlug:"test",result:{status:"executed"}};}}));
vi.mock("@/lib/db",()=>({prisma:{aiRationaleEnrichment:{findUnique:async()=>{state.effects.push("memory-read");return {narrative:"test",riskFactorsJson:[],nextActionsJson:[]};}}}}));
vi.mock("@/lib/audit/secureAudit",()=>({record:async()=>{state.effects.push("audit");}}));
import { POST as github } from "@/app/api/workforce/integrations/github/route";
import { POST as slack } from "@/app/api/workforce/integrations/slack-actions/route";
import { POST as linear } from "@/app/api/workforce/integrations/linear/route";
import { POST as githubTest } from "@/app/api/workforce/integrations/github/test/route";
import { POST as linearTest } from "@/app/api/workforce/integrations/linear/test/route";
import { POST as dispatch } from "@/app/api/workforce/integrations/dispatch-from-memory/route";
const routes=[github,slack,linear,githubTest,linearTest,dispatch];
function request(origin:string|null="https://axiom.invalid"){
 const body=new URLSearchParams({repo:"owner/repo",patReference:"env://TEST_REFERENCE",issueLabel:"test",webhookUrl:"https://hooks.slack.com/services/test",teamId:"team",apiKeyReference:"env://TEST_REFERENCE",labelName:"test",targetKind:"finding",targetId:"test",kind:"github_issue"});
 return new NextRequest("https://axiom.invalid/api/workforce/integrations/test",{method:"POST",headers:{...(origin?{origin}:{}),"content-type":"application/x-www-form-urlencoded"},body});
}
beforeEach(()=>{state.roles=["security_reviewer"];state.stable=true;state.effects=[];});
it.each(routes)("refuses reviewer connection changes and dispatch before any store/provider side effect",async route=>{
 const response=await route(request());expect(response.status).toBe(403);expect(state.effects).toEqual([]);
});
it.each(routes)("refuses cross-origin Owner requests before side effects",async route=>{
 state.roles=["owner"];const response=await route(request("https://untrusted.invalid"));expect(response.status).toBe(403);expect(state.effects).toEqual([]);
});
it.each(routes)("requires stable authenticated identity before connection mutation",async route=>{
 state.roles=["owner"];state.stable=false;const response=await route(request());expect(response.status).toBe(401);expect(state.effects).toEqual([]);
});
it("preserves explicit same-origin Owner connection configuration",async()=>{
 state.roles=["owner"];const response=await github(request());expect(response.status).toBe(303);expect(state.effects).toEqual(["config-written","audit"]);
});
it.each(["read_only","finance_viewer","operator"])("does not let %s configure connections",async role=>{
 state.roles=[role];const response=await github(request());expect(response.status).toBe(403);expect(state.effects).toEqual([]);
});
it.each(["read_only","finance_viewer"])("does not let %s dispatch external actions",async role=>{
 state.roles=[role];const response=await dispatch(request());expect(response.status).toBe(403);expect(state.effects).toEqual([]);
});
it("preserves explicit Operator dispatch with the actions apply permission",async()=>{
 state.roles=["operator"];const response=await dispatch(request());expect(response.status).toBe(303);expect(state.effects).toEqual(["memory-read","external-action","audit"]);
});
it.each(routes)("rejects missing Origin even for the Owner",async route=>{
 state.roles=["owner"];const response=await route(request(null));expect(response.status).toBe(403);expect(state.effects).toEqual([]);
});
it("preserves Admin configuration authority",async()=>{
 state.roles=["admin"];const response=await linear(request());expect(response.status).toBe(303);expect(state.effects).toEqual(["config-written","audit"]);
});
