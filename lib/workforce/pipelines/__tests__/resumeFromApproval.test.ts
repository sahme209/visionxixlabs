import { describe, it, expect } from "vitest";
import { resumePipelineStageFromApproval } from "../resumeFromApproval";

describe("resumePipelineStageFromApproval", () => {
  it("approved → stage succeeded + advance", () => {
    const r = resumePipelineStageFromApproval("approved");
    expect(r.stageStatus).toBe("succeeded");
    expect(r.shouldAdvanceRun).toBe(true);
    expect(r.errorMessage).toBeUndefined();
  });

  it("rejected → stage failed + advance, with error", () => {
    const r = resumePipelineStageFromApproval("rejected");
    expect(r.stageStatus).toBe("failed");
    expect(r.shouldAdvanceRun).toBe(true);
    expect(r.errorMessage).toMatch(/rejected/i);
  });

  it("expired → stage failed + advance, with TTL note", () => {
    const r = resumePipelineStageFromApproval("expired");
    expect(r.stageStatus).toBe("failed");
    expect(r.shouldAdvanceRun).toBe(true);
    expect(r.errorMessage).toMatch(/expired/i);
  });

  it("pending → no-op", () => {
    const r = resumePipelineStageFromApproval("pending");
    expect(r.stageStatus).toBe("no_change");
    expect(r.shouldAdvanceRun).toBe(false);
    expect(r.errorMessage).toBeUndefined();
  });
});
