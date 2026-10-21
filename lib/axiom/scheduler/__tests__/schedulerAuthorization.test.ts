import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({updateMany:vi.fn(),deleteMany:vi.fn(),due:vi.fn(),update:vi.fn(),run:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{axiomScheduledRun:{updateMany:m.updateMany,deleteMany:m.deleteMany,findMany:m.due,update:m.update}}}));
vi.mock("@/lib/axiom/agent/runAgent",()=>({runAgent:m.run}));
vi.mock("@/lib/axiom/scheduler/diffEngine",()=>({diffRuns:vi.fn()}));
vi.mock("@/lib/axiom/diffEngine",()=>({compareAgentRuns:vi.fn()}));
vi.mock("@/lib/axiom/scheduler/notifications",()=>({buildNotifications:{scanFailed:vi.fn(()=>({})),fromDiff:vi.fn(()=>[])}}));
import {updateSchedule,deleteSchedule,processScheduledRuns,listSchedules} from "../scheduler";
beforeEach(()=>{vi.resetAllMocks();m.updateMany.mockResolvedValue({count:1});m.deleteMany.mockResolvedValue({count:1});m.due.mockResolvedValue([]);m.update.mockResolvedValue({});m.run.mockResolvedValue({status:"failed",runId:"run"});});
describe("scheduled-operation storage scoping",()=>{
 it("binds updates to schedule and organization together",async()=>{expect(await updateSchedule("schedule","org",{enabled:false})).toBe(true);expect(m.updateMany).toHaveBeenCalledWith({where:{id:"schedule",organizationId:"org"},data:{enabled:false}});});
 it("binds deletion to schedule and organization together",async()=>{expect(await deleteSchedule("schedule","org")).toBe(true);expect(m.deleteMany).toHaveBeenCalledWith({where:{id:"schedule",organizationId:"org"}});});
 it("reports a row moved or removed after authorization without unscoped fallback",async()=>{m.updateMany.mockResolvedValue({count:0});m.deleteMany.mockResolvedValue({count:0});expect(await updateSchedule("schedule","org",{enabled:false})).toBe(false);expect(await deleteSchedule("schedule","org")).toBe(false);expect(m.update).not.toHaveBeenCalled();});
 it("does not execute or notify across an inconsistent schedule/account tenant relation",async()=>{
  m.due.mockResolvedValue([{id:"schedule",organizationId:"org",frequency:"daily",cloudAccount:{id:"account",organizationId:"other",enabled:true,provider:"aws"}}]);
  expect(await processScheduledRuns()).toMatchObject({processed:1,skipped:1,succeeded:0,notifications:[]});expect(m.run).not.toHaveBeenCalled();expect(m.update).toHaveBeenCalledWith({where:{id:"schedule"},data:{consecutiveFailures:{increment:1}}});
 });
 it("preserves execution for a consistently scoped enabled cloud account",async()=>{
  m.due.mockResolvedValue([{id:"schedule",organizationId:"org",frequency:"daily",cloudAccount:{id:"account",organizationId:"org",enabled:true,provider:"aws"}}]);
  expect(await processScheduledRuns()).toMatchObject({processed:1,skipped:0,failed:1});expect(m.run).toHaveBeenCalledWith(expect.objectContaining({organizationId:"org",connectedAccountId:"account",provider:"aws",trigger:"scheduled"}));
 });

 it("filters included cloud-account metadata by the same organization",async()=>{
  await listSchedules("org");expect(m.due).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:"org",cloudAccount:{is:{organizationId:"org"}}}}));
 });

});
