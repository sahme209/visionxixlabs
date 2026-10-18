/** @vitest-environment jsdom */
import {createElement} from "react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {desktopClient} from "../../../desktop/src/lib/desktopClient";
import {TerraformPlanReview} from "../../../desktop/src/components/TerraformPlanReview";
import type {TerraformPlanReadData} from "../../terraform/customerPlanDto";
const metadata={id:`tfcp_${"a".repeat(64)}`,binaryDigest:"b".repeat(64),binaryBytes:123,environmentId:"env-owned",requestVersion:1,terraformVersion:"1.9.8",createdAt:"2026-10-18T12:00:00Z",expiresAt:"2026-10-18T12:15:00Z",evidenceScope:"customer_ci_attested" as const,inspection:"metadata_only" as const,approval:"unavailable" as const,currentTarget:"not_observed" as const,executionEnabled:false as const,historical:false,profileId:"profile-owned",profileRevision:1,runId:"888",runAttempt:1};
const data=():TerraformPlanReadData=>({plans:[metadata],truncated:false,producer:"customer_ci_import",executionEnabled:false});
beforeEach(()=>{desktopClient.setSession("axm.desk.synthetic.signature");});
afterEach(()=>{cleanup();vi.restoreAllMocks();desktopClient.setSession(undefined);});
it("reads customer metadata and explicitly labels a fresh backend observation with no held lock or apply authority",async()=>{
 vi.spyOn(desktopClient,"listDeploymentTerraformPlans").mockResolvedValue({ok:true,data:data()});vi.spyOn(desktopClient,"getDeploymentTerraformPlan").mockResolvedValue({ok:true,data:{...data(),plans:[{...metadata,inspection:"producer_bytes_verified",currentTarget:"observed_match",validity:"unexpired",observedAt:"2026-10-18T12:01:00Z",summary:{rows:[],counts:{create:1,update:0,delete:0,replace:0,read:0,"no-op":0},byProvider:[],destructive:[],severity:"low"}}]}});
 render(createElement(TerraformPlanReview,{requestId:"request-owned",requestVersion:1}));fireEvent.click(screen.getByRole("button",{name:"Read saved plan metadata"}));fireEvent.click(await screen.findByRole("button",{name:/Inspect bbbbbbbbbbbb/}));expect(await screen.findByText(/Backend matched at.*no lock is held/)).not.toBeNull();expect(screen.getByText(/Customer producer bytes verified/)).not.toBeNull();expect(screen.queryByRole("button",{name:/apply|approve|upload/i})).toBeNull();
});
it("renders expired historical signed evidence separately from unavailable current target",async()=>{
 vi.spyOn(desktopClient,"listDeploymentTerraformPlans").mockResolvedValue({ok:true,data:{...data(),plans:[{...metadata,historical:true}]}});vi.spyOn(desktopClient,"getDeploymentTerraformPlan").mockResolvedValue({ok:true,data:{...data(),plans:[{...metadata,historical:true,inspection:"producer_bytes_verified",currentTarget:"unavailable",validity:"expired",summary:{rows:[],counts:{create:0,update:0,delete:0,replace:0,read:0,"no-op":0},byProvider:[],destructive:[],severity:"noop"}}]}});
 render(createElement(TerraformPlanReview,{requestId:"request-owned",requestVersion:2}));fireEvent.click(screen.getByRole("button",{name:"Read saved plan metadata"}));fireEvent.click(await screen.findByRole("button",{name:/Inspect bbbbbbbbbbbb/}));expect(await screen.findByText(/Customer producer bytes verified.*historical evidence.*expired/)).not.toBeNull();expect(screen.getByText(/Current backend match is unavailable/)).not.toBeNull();expect(screen.queryByText(/Backend matched at/)).toBeNull();
});
it("profile refresh invalidates a pending saved-plan list so late evidence cannot reappear",async()=>{
 let finish!:(result:{ok:true;data:TerraformPlanReadData})=>void;vi.spyOn(desktopClient,"listDeploymentTerraformPlans").mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));vi.spyOn(desktopClient,"getDeploymentTerraformProfile").mockResolvedValue({ok:true,data:{kind:"customer_plan_profile",profile:null,status:"unconfigured",currentTarget:"unavailable",approval:"unavailable",executionAllowed:false,permissions:{configure:false,import:false}}});
 render(createElement(TerraformPlanReview,{requestId:"request-owned",requestVersion:1}));fireEvent.click(screen.getByRole("button",{name:"Read saved plan metadata"}));fireEvent.click(screen.getByRole("button",{name:"Read customer plan profile"}));await screen.findByText(/Current role can read evidence/);await act(async()=>finish({ok:true,data:data()}));expect(screen.queryByRole("button",{name:/Inspect bbbbbbbbbbbb/})).toBeNull();
});
