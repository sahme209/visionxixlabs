/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const state=vi.hoisted(()=>({args:{} as Record<string,unknown>,tool:"commit_github_files"}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:async()=>({isAuthenticated:true,organizationId:"ws_shared",userId:"reviewer",email:"reviewer@example.test",roles:["security_reviewer"]})}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error(url);}}));
vi.mock("@/lib/db",()=>({prisma:{orgMembership:{groupBy:async()=>[]},environment:{findMany:async()=>[]},agentActionProposal:{findMany:async()=>[{id:"proposal",toolName:state.tool,argsJson:state.args,riskLevel:"medium",createdAt:new Date(),approvalExpiresAt:new Date(Date.now()+3600000),actionDigest:"bound-digest",proposedByUserId:"owner"}]}}}));
import Page from "@/app/control/governance/page";
beforeEach(()=>{state.tool="commit_github_files";state.args={repositoryFullName:"owner/acceptance",branch:"acceptance/test",message:"Add subtraction",files:[{path:"src/calc.js",content:"export const subtract = (a, b) => a - b;"},{path:"test/calc.test.js",content:"assert.equal(subtract(2, 5), -3);"}],_review:{kind:"github_files",files:[{path:"src/calc.js",baseSha:"abc",baseContent:"export const add = (a, b) => a + b;",htmlUrl:null},{path:"test/calc.test.js",baseSha:"def",baseContent:"assert.equal(add(2, 3), 5);",htmlUrl:null}]}};});
afterEach(cleanup);
it("shows exact repository, branch and bound before/after contents to the independent reviewer",async()=>{
 render(await Page());
 expect(screen.getByText(/owner\/acceptance/)).toBeTruthy();
 expect(screen.getByText(/acceptance\/test/)).toBeTruthy();
 expect(screen.getByText("Add subtraction")).toBeTruthy();
 expect(screen.getByText("export const add = (a, b) => a + b;")).toBeTruthy();
 expect(screen.getByText("export const subtract = (a, b) => a - b;")).toBeTruthy();
 expect(screen.getByText("assert.equal(subtract(2, 5), -3);")).toBeTruthy();
 expect(screen.getByRole("button",{name:"Approve & execute"}).hasAttribute("disabled")).toBe(false);
});
it("withholds approval when a proposed file has no matching trusted review snapshot",async()=>{
 (state.args._review as {files:unknown[]}).files.pop();
 render(await Page());
 expect(screen.getByRole("button",{name:"Approve & execute"}).hasAttribute("disabled")).toBe(true);
 expect(screen.getByRole("alert").textContent).toContain("File review is unavailable");
});

it("shows the exact PR repository, head, base, title and body before independent approval",async()=>{
 state.tool="open_github_pull_request";state.args={repositoryFullName:"owner/acceptance",head:"acceptance/test",base:"main",title:"Review subtract",body:"Temporary acceptance pull request."};
 render(await Page());
 expect(screen.getByText("Review pull request")).toBeTruthy();expect(screen.getByText(/Repository: owner\/acceptance/)).toBeTruthy();
 expect(screen.getByText(/Head: acceptance\/test/)).toBeTruthy();expect(screen.getByText(/Base: main/)).toBeTruthy();
 expect(screen.getByText("Review subtract")).toBeTruthy();expect(screen.getByText("Temporary acceptance pull request.")).toBeTruthy();
 expect(screen.getByRole("button",{name:"Approve & execute"}).hasAttribute("disabled")).toBe(false);
});
it("withholds PR approval when target or title cannot be reviewed",async()=>{
 state.tool="open_github_pull_request";state.args={repositoryFullName:"owner/acceptance",head:"acceptance/test",base:"main"};
 render(await Page());expect(screen.getByRole("button",{name:"Approve & execute"}).hasAttribute("disabled")).toBe(true);
});
