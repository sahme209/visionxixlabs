/** @vitest-environment jsdom */
import { createElement } from "react";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const fixture=vi.hoisted(()=>({path:"/control",read:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>fixture.path, useRouter:()=>({push:vi.fn(),refresh:vi.fn()}),redirect:(url:string)=>{throw Error(url);}}));
vi.mock("next-auth/react",()=>({signOut:vi.fn()}));
vi.mock("next/image",()=>({default:"img"}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:async()=>({isAuthenticated:true,userId:"visual-user",email:"member@example.test",workspaceLabel:"Example workspace",organizationId:"visual-org",roles:["owner"]})}));
vi.mock("@/lib/db",()=>({prisma:{
 user:{findUnique:async()=>({name:"Example Member"}),findMany:async()=>[{id:"visual-user",email:"member@example.test"}]},
 orgMembership:{count:async()=>1,findUnique:async()=>({role:"owner",acceptedAt:new Date("2026-10-01")}),findMany:async()=>[{id:"member-1",userId:"visual-user",role:"owner",acceptedAt:new Date("2026-10-01"),providerScopes:[]}],groupBy:async()=>[{role:"owner",_count:{_all:1}}]},
 environment:{count:async()=>3,findMany:async()=>[]},agentActionProposal:{count:async()=>0,findMany:async()=>[]},
 tenantIntegrationConnection:{count:async()=>0,findMany:async()=>[]},gitHubInstallation:{findFirst:async()=>({id:"installation-1",status:"active",repositorySelection:"selected",lastSeenAt:new Date()})},connectorSetupSession:{findMany:async()=>[]},
 secureAuditRecord:{count:async()=>0,findMany:async()=>[]},desktopSessionRecord:{count:async()=>1},
 usageEvent:{aggregate:async()=>({_count:{_all:0},_sum:{inputTokens:0,outputTokens:0,billedCents:0}}),count:async()=>0},addOnPurchase:{findMany:async()=>[]},
 agentSkillInstallation:{findMany:async()=>[]},
}}));
vi.mock("@/lib/connectors/github/githubConfig",()=>({getGithubConfig:async()=>({}),isGithubAppInstallationReady:()=>false}));
vi.mock("@/lib/billing/tenantBillingStore",()=>({readBillingPlanWithAvailability:async()=>({available:true,plan:{tier:"free",status:"active",publicPlanId:"free",pricingPlanAvailable:true,seatQuantity:2}})}));
vi.mock("@/lib/billing/deploymentQuota",()=>({checkDeploymentQuota:async()=>({allowed:true,used:2,limit:10})}));
vi.mock("@/lib/billing/currentAIAllowance",()=>({readCurrentAIAllowance:async()=>({available:true,includedRemainingCents:200,poolCents:200,heldCents:0,overagePolicy:"hard_stop",addOnCents:0})}));
vi.mock("@/lib/billing/stripeHelper",()=>({describeStripeStatus:()=>({mode:"test"})}));
vi.mock("@/lib/billing/isolatedApplication/scope",()=>({withIsolatedWorkspaceScope:(_context:unknown,_kind:unknown,operation:()=>unknown)=>operation()}));
import { CockpitShell } from "@/components/cockpit/CockpitShell";
import Overview from "@/app/control/page";
import Integrations from "@/app/control/integrations/page";
import Settings from "@/app/control/settings/page";
import Billing from "@/app/control/usage-billing/page";
import Members from "@/app/control/members/page";
import Plugins from "@/app/control/plugins/page";
import Plans from "@/app/control/plans/page";
import Governance from "@/app/control/governance/page";
import AIAgents from "@/app/control/ai-agents/page";
import Audit from "@/app/control/audit-security/page";

const previewDir=process.env.AXIOM_COCKPIT_VISUAL_DIRECTORY;
function save(name:string){
 if(!previewDir)return;
 const css=readFileSync(join(previewDir,"styles.css"),"utf8").replace(/@import\s+url\([^)]*\);?/g,"")+readFileSync("components/cockpit/cockpit.css","utf8");
 const logo=readFileSync("public/vision-xix-logo.png").toString("base64");
 const clone=document.body.cloneNode(true) as HTMLElement;
 for(const img of clone.querySelectorAll("img"))img.src=`data:image/png;base64,${logo}`;
 writeFileSync(join(previewDir,`${name}.html`),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Axiom ${name} · component preview</title><style>${css}</style></head><body>${clone.innerHTML}<div style="position:fixed;bottom:8px;right:8px;z-index:200;background:#27272a;border:1px solid #52525b;border-radius:6px;padding:5px 9px;color:#d4d4d8;font:10px system-ui">Component preview · test data · no live account</div></body></html>`);
}
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it("renders the real cockpit pages in one frame with honest fixture state",async()=>{
 vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED","true");
 const device={id:"fixture-device",userId:"visual-user",deviceLabel:"Example workstation",platform:"macOS",desktopVersion:"0.1.20",issuedAt:"2026-10-01T12:00:00Z",expiresAt:"2026-11-01T12:00:00Z",lastSeenAt:"2026-10-22T14:00:00Z",status:"active"};
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes("ai-governance") ? {ok:true,data:{canManage:false,providerPolicy:{enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]},availableProviders:[],gatewayModels:[],gatewayCatalogLive:false,agentIdentityState:"migration_pending",agentIdentity:null,autonomy:null,budget:null,tools:[]}} : {data:{sessions:[device]}}),{status:200})));
 const pages=[
  {name:"overview",path:"/control",page:()=>Overview(),heading:"Overview"},
  {name:"integrations",path:"/control/integrations",page:()=>Integrations(),heading:"Integrations"},
  {name:"settings",path:"/control/settings",page:()=>Settings({}),heading:"Settings"},
  {name:"billing",path:"/control/usage-billing",page:()=>Billing({}),heading:"Usage & billing"},
  {name:"members",path:"/control/members",page:()=>Members({}),heading:"Members"},
  {name:"plugins",path:"/control/plugins",page:()=>Plugins(),heading:"Plugins & skills"},
  {name:"plans",path:"/control/plans",page:()=>Plans({}),heading:"Choose your plan"},
  {name:"governance",path:"/control/governance",page:()=>Governance(),heading:"Governance"},
  {name:"ai-agents",path:"/control/ai-agents",page:async()=>createElement(AIAgents),heading:"AI & Agents"},
  {name:"audit",path:"/control/audit-security",page:()=>Audit(),heading:"Audit & security"},
 ];
 for(const page of pages){
  fixture.path=page.path;
  render(createElement(CockpitShell,{email:"member@example.test",workspace:"Example workspace",roles:["owner"]},await page.page()));
  expect(screen.getByRole("navigation",{name:"Axiom cockpit"})).toBeTruthy();
  expect(screen.getByRole("heading",{name:page.heading})).toBeTruthy();
  if(page.name==="ai-agents")await waitFor(()=>expect(screen.getByText("Approved model routing")).toBeTruthy());
  if(page.name==="audit")await screen.findByText("Example workstation");
  save(page.name);
  if(page.name==="settings"){
   fireEvent.click(screen.getByRole("tab",{name:"Security"}));save("security");
   fireEvent.click(screen.getByRole("tab",{name:"Sessions"}));await screen.findByText("Example workstation");save("sessions");
   fireEvent.click(screen.getByRole("button",{name:"Revoke device"}));save("revoke-dialog");fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  }
  if(page.name==="billing"){
   fireEvent.click(screen.getByRole("tab",{name:"Usage"}));save("usage");
   fireEvent.click(screen.getByRole("tab",{name:"Invoices"}));save("invoices");
   expect(screen.queryByRole("button",{name:"Manage billing"})).toBeNull();
  }
  if(page.name==="integrations"){
   fireEvent.click(screen.getByRole("button",{name:"Manage"}));
   fireEvent.click(screen.getByRole("menuitem",{name:"Disconnect"}));
   expect(screen.getByRole("dialog",{name:"Disconnect GitHub?"})).toBeTruthy();save("disconnect-dialog");
  }
  cleanup();
 }
});
