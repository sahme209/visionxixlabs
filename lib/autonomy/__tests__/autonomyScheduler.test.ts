import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationId } from "@/lib/domain/ids";

const io = vi.hoisted(() => ({
  env: vi.fn(),
  gate: vi.fn(),
  cycle: vi.fn(),
  notify: vi.fn(),
  persist: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({ loadAppEnv: io.env }));
vi.mock("@/lib/billing/tierGate", () => ({ gateAndConsume: io.gate }));
vi.mock("@/lib/notifications/outboundNotificationLane", () => ({ sendOutboundNotification: io.notify }));
vi.mock("../autonomousLoopRunner", () => ({ runAutonomousLoopCycle: io.cycle }));
vi.mock("../tenantCharterStore", () => ({ readTenantCharter: async () => null }));
vi.mock("../decisionRationaleStore", () => ({ recordCycleRationale: io.persist }));

import { clearAutonomyHistory, runSchedulerTick } from "../autonomyScheduler";

const tenantIds = ["synthetic-tenant-a", "synthetic-tenant-b"] as OrganizationId[];
const firstReport = {
  candidates: [{
    id: "synthetic-candidate",
    title: "Synthetic review",
    outcome: "approval_packet_prepared",
    evidenceRefs: [],
  }],
  summary: { candidatesConsidered: 1, haltedAtGate: 1 },
};
const secondReport = {
  candidates: [],
  summary: { candidatesConsidered: 0, haltedAtGate: 0 },
};

describe("scheduler rationale completion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearAutonomyHistory();
    io.env.mockReturnValue({ autonomySchedulerEnabled: true });
    io.gate.mockResolvedValue({ allowed: true });
    io.cycle.mockResolvedValueOnce(firstReport).mockResolvedValueOnce(secondReport);
    io.persist.mockResolvedValue({ written: 0, failed: 0 });
  });

  it("waits for outstanding evidence writes before completing the tick", async () => {
    const write = Promise.withResolvers<{ written: number; failed: number }>();
    io.persist.mockReturnValueOnce(write.promise);
    let finished = false;
    const tick = runSchedulerTick({ tenantIds }).finally(() => { finished = true; });

    await vi.waitFor(() => expect(io.persist).toHaveBeenCalledTimes(2));
    expect(io.notify).toHaveBeenCalledOnce();
    expect(finished).toBe(false);
    write.resolve({ written: 1, failed: 0 });

    expect(await tick).toMatchObject({ ran: true, cycles: [firstReport, secondReport], skipped: [] });
    expect(io.persist).toHaveBeenNthCalledWith(1, { organizationId: tenantIds[0], report: firstReport });
    expect(io.persist).toHaveBeenNthCalledWith(2, { organizationId: tenantIds[1], report: secondReport });
  });

  it("keeps evidence errors best effort and does not repeat a cycle", async () => {
    io.persist.mockRejectedValueOnce(new Error("synthetic write failure"));
    expect(await runSchedulerTick({ tenantIds })).toMatchObject({ ran: true, cycles: [firstReport, secondReport], skipped: [] });
    expect(io.gate).toHaveBeenCalledTimes(2);
    expect(io.cycle).toHaveBeenCalledTimes(2);
    expect(io.persist).toHaveBeenCalledTimes(2);
    expect(io.notify).toHaveBeenCalledOnce();
  });

  it("drains the prior cycle's write if a later tenant gate fails", async () => {
    const write = Promise.withResolvers<{ written: number; failed: number }>();
    const gateFailure = new Error("synthetic gate unavailable");
    io.persist.mockReturnValueOnce(write.promise);
    io.gate.mockResolvedValueOnce({ allowed: true }).mockRejectedValueOnce(gateFailure);
    let finished = false;
    const tick = runSchedulerTick({ tenantIds }).catch(error => {
      finished = true;
      return error;
    });

    await vi.waitFor(() => expect(io.gate).toHaveBeenCalledTimes(2));
    expect(finished).toBe(false);
    write.resolve({ written: 1, failed: 0 });

    expect(await tick).toBe(gateFailure);
    expect(io.cycle).toHaveBeenCalledOnce();
    expect(io.persist).toHaveBeenCalledOnce();
  });

  it("leaves the disabled scheduler without cycles, writes or notifications", async () => {
    io.env.mockReturnValue({ autonomySchedulerEnabled: false });
    expect(await runSchedulerTick({ tenantIds })).toMatchObject({ ran: false, cycles: [] });
    expect(io.gate).not.toHaveBeenCalled();
    expect(io.cycle).not.toHaveBeenCalled();
    expect(io.persist).not.toHaveBeenCalled();
    expect(io.notify).not.toHaveBeenCalled();
  });
});
