import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({findFirst:vi.fn(),updateMany:vi.fn(),deleteMany:vi.fn(),due:vi.fn(),update:vi.fn(),run:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{axiomScheduledRun:{findFirst:m.findFirst,updateMany:m.updateMany,deleteMany:m.deleteMany,findMany:m.due,update:m.update}}}));
vi.mock("@/lib/axiom/agent/runAgent",()=>({runAgent:m.run}));
vi.mock("@/lib/axiom/scheduler/diffEngine",()=>({diffRuns:vi.fn()}));
vi.mock("@/lib/axiom/diffEngine",()=>({compareAgentRuns:vi.fn()}));
vi.mock("@/lib/axiom/scheduler/notifications",()=>({buildNotifications:{scanFailed:vi.fn(()=>({})),fromDiff:vi.fn(()=>[])}}));
import {buildNotifications} from "../notifications";
import {updateSchedule,deleteSchedule,processScheduledRuns,listSchedules} from "../scheduler";
beforeEach(()=>{vi.resetAllMocks();m.findFirst.mockResolvedValue({updatedAt:new Date(0)});m.updateMany.mockResolvedValue({count:1});m.deleteMany.mockResolvedValue({count:1});m.due.mockResolvedValue([]);m.update.mockResolvedValue({});m.run.mockResolvedValue({status:"failed",runId:"run"});});
describe("scheduled-operation storage scoping",()=>{
 it("binds updates to schedule and organization together",async()=>{expect(await updateSchedule("schedule","org",{enabled:false})).toBe(true);expect(m.updateMany).toHaveBeenCalledWith({where:{id:"schedule",organizationId:"org",updatedAt:new Date(0)},data:{enabled:false,updatedAt:expect.any(Date)}});});
 it("binds deletion to schedule and organization together",async()=>{expect(await deleteSchedule("schedule","org")).toBe(true);expect(m.deleteMany).toHaveBeenCalledWith({where:{id:"schedule",organizationId:"org"}});});
 it("reports a row moved or removed after authorization without unscoped fallback",async()=>{m.updateMany.mockResolvedValue({count:0});m.deleteMany.mockResolvedValue({count:0});expect(await updateSchedule("schedule","org",{enabled:false})).toBe(false);expect(await deleteSchedule("schedule","org")).toBe(false);expect(m.update).not.toHaveBeenCalled();});
 it("does not execute or notify across an inconsistent schedule/account tenant relation",async()=>{
  m.due.mockResolvedValue([{id:"schedule",organizationId:"org",frequency:"daily",cloudAccount:{id:"account",organizationId:"other",enabled:true,provider:"aws"}}]);
  expect(await processScheduledRuns()).toMatchObject({processed:1,skipped:1,succeeded:0,notifications:[]});expect(m.run).not.toHaveBeenCalled();expect(m.update).toHaveBeenCalledWith({where:{id:"schedule"},data:{consecutiveFailures:{increment:1}}});
 });
 it("preserves execution for a consistently scoped enabled cloud account",async()=>{
  m.due.mockResolvedValue([{id:"schedule",organizationId:"org",frequency:"daily",nextRunAt:new Date(0),updatedAt:new Date(0),enabled:true,consecutiveFailures:0,cloudAccountId:"account",cloudAccount:{id:"account",organizationId:"org",enabled:true,provider:"aws"}}]);
  expect(await processScheduledRuns()).toMatchObject({processed:1,skipped:0,failed:1});expect(m.run).toHaveBeenCalledWith(expect.objectContaining({organizationId:"org",connectedAccountId:"account",provider:"aws",trigger:"scheduled"}));
 });

 it("filters included cloud-account metadata by the same organization",async()=>{
  await listSchedules("org");expect(m.due).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:"org",cloudAccount:{is:{organizationId:"org"}}}}));
 });

});

describe("scheduled occurrence claims",()=>{
 const due=()=>({id:"schedule",organizationId:"org",cloudAccountId:"account",frequency:"daily",nextRunAt:new Date(0),updatedAt:new Date(0),enabled:true,consecutiveFailures:0,cloudAccount:{id:"account",organizationId:"org",enabled:true,provider:"aws"}});
 it("dispatches only the winner of overlapping due snapshots",async()=>{
  m.due.mockResolvedValue([due()]); let claimed=false;
  m.updateMany.mockImplementation(async ({where})=>{if(where.nextRunAt?.getTime()===0){if(claimed)return {count:0};claimed=true;}return {count:1};});
  await Promise.all([processScheduledRuns(),processScheduledRuns()]);expect(m.run).toHaveBeenCalledTimes(1);
 });
 it("does not dispatch after a lost occurrence claim",async()=>{m.due.mockResolvedValue([due()]);m.updateMany.mockResolvedValue({count:0});expect(await processScheduledRuns()).toMatchObject({skipped:1});expect(m.run).not.toHaveBeenCalled();});
 it("fails closed when claiming storage is unavailable",async()=>{m.due.mockResolvedValue([due()]);m.updateMany.mockRejectedValue(new Error("storage unavailable"));await expect(processScheduledRuns()).rejects.toThrow("storage unavailable");expect(m.run).not.toHaveBeenCalled();});
 it("does not perform unscoped completion writes",async()=>{m.due.mockResolvedValue([due()]);await processScheduledRuns();expect(m.update).not.toHaveBeenCalled();expect(m.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({where:expect.objectContaining({id:"schedule",organizationId:"org",cloudAccountId:"account",updatedAt:expect.any(Date),nextRunAt:expect.any(Date)})}));});
});

describe("schedule completion fencing",()=>{
 const due=()=>({id:"schedule",organizationId:"org",cloudAccountId:"account",frequency:"daily",nextRunAt:new Date(0),updatedAt:new Date(0),enabled:true,consecutiveFailures:0,cloudAccount:{id:"account",organizationId:"org",enabled:true,provider:"aws"}});
 it("uses the observed row version and tenant relation in the atomic claim",async()=>{const row=due();m.due.mockResolvedValue([row]);await processScheduledRuns();const claim=m.updateMany.mock.calls[0][0];expect(claim.where).toMatchObject({id:row.id,organizationId:row.organizationId,cloudAccountId:row.cloudAccountId,nextRunAt:row.nextRunAt,updatedAt:row.updatedAt,enabled:true,consecutiveFailures:{lt:3},cloudAccount:{is:{organizationId:"org"}}});expect(claim.data.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());});
 it("never retries or advances again when a schedule edit invalidates completion",async()=>{m.due.mockResolvedValue([due()]);m.updateMany.mockResolvedValueOnce({count:1}).mockResolvedValue({count:0});await processScheduledRuns();expect(m.run).toHaveBeenCalledTimes(1);expect(m.updateMany).toHaveBeenCalledTimes(2);const [claim,completion]=m.updateMany.mock.calls.map(([arg])=>arg);expect(completion.where.nextRunAt).toEqual(claim.data.nextRunAt);expect(completion.where.updatedAt).toEqual(claim.data.updatedAt);expect(completion.data).not.toHaveProperty("nextRunAt");expect(m.update).not.toHaveBeenCalled();expect(buildNotifications.scanFailed).not.toHaveBeenCalled();});
 it("records thrown dispatch failure without granting a retry",async()=>{m.due.mockResolvedValue([due()]);m.run.mockRejectedValue(new Error("dispatch uncertain"));const spy=vi.spyOn(console,"error").mockImplementation(()=>{});try{expect(await processScheduledRuns()).toMatchObject({failed:1});expect(m.run).toHaveBeenCalledTimes(1);expect(m.updateMany).toHaveBeenCalledTimes(2);expect(m.updateMany.mock.calls[1][0].data).toEqual({consecutiveFailures:{increment:1}});}finally{spy.mockRestore();}});
});

it("advances administrator versions beyond a claim even in the same millisecond",async()=>{const claimed=new Date(Date.now()+1000);m.findFirst.mockResolvedValue({updatedAt:claimed});await updateSchedule("schedule","org",{enabled:true});const write=m.updateMany.mock.calls[0][0];expect(write.where.updatedAt).toEqual(claimed);expect(write.data.updatedAt.getTime()).toBe(claimed.getTime()+1);expect(write.data.consecutiveFailures).toBe(0);});
it("does not update a schedule removed before reading its version",async()=>{m.findFirst.mockResolvedValue(null);expect(await updateSchedule("schedule","org",{enabled:false})).toBe(false);expect(m.updateMany).not.toHaveBeenCalled();});

it("suppresses stale completion notifications and approval follow-ons",async()=>{m.due.mockResolvedValue([{id:"schedule",organizationId:"org",cloudAccountId:"account",frequency:"daily",nextRunAt:new Date(0),updatedAt:new Date(0),cloudAccount:{id:"account",organizationId:"org",enabled:true,provider:"aws"}}]);m.updateMany.mockResolvedValueOnce({count:1}).mockResolvedValue({count:0});m.run.mockResolvedValue({status:"completed",runId:"run",approvalRequiredCount:1,autoFixCount:1});expect(await processScheduledRuns()).toMatchObject({skipped:1,succeeded:0,notifications:[]});expect(buildNotifications.fromDiff).not.toHaveBeenCalled();expect(buildNotifications.scanFailed).not.toHaveBeenCalled();});
