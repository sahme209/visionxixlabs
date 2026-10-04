/**
 * P0 containment: the legacy "Cloud Operator" self-serve terraform-apply
 * path (leadId/starter-token based, no tenant/role model, no relationship
 * to terraformBoundary.ts) must stay off by default. Locks in that
 * terraformApply() refuses to execute unless
 * TERRAFORM_LEGACY_APPLY_ENABLED is exactly "true", regardless of the
 * job's own approval state — the kill-switch is checked before the
 * approval/status checks, not instead of them.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findJob: vi.fn(),
  updateJob: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    terraformExecutionJob: { findUnique: mocks.findJob, update: mocks.updateJob },
  },
}));

const unapprovedJob = {
  id: "job-1",
  workingDirectory: "/tmp/job-1",
  approvedAt: null,
  approvedBy: null,
  status: "planned",
};

const approvedJob = {
  ...unapprovedJob,
  approvedAt: new Date(),
  approvedBy: "lead-1",
  status: "awaiting_approval",
};

describe("terraformApply kill-switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("blocks apply when the flag is unset, even for an approved job", async () => {
    mocks.findJob.mockResolvedValue({ ...approvedJob });
    const { terraformApply } = await import("../runner");
    const result = await terraformApply("job-1");

    expect(result.success).toBe(false);
    expect(result.blockedByKillSwitch).toBe(true);
    expect(result.output).toMatch(/temporarily disabled/i);
    // Never transitions the job to "applying" or touches it at all.
    expect(mocks.updateJob).not.toHaveBeenCalled();
  });

  it("blocks apply for any value other than the exact string \"true\"", async () => {
    vi.stubEnv("TERRAFORM_LEGACY_APPLY_ENABLED", "1");
    mocks.findJob.mockResolvedValue({ ...approvedJob });
    const { terraformApply } = await import("../runner");
    const result = await terraformApply("job-1");

    expect(result.success).toBe(false);
    expect(result.blockedByKillSwitch).toBe(true);
  });

  it("is checked before the job-approval check (kill-switch wins even on an unapproved job)", async () => {
    mocks.findJob.mockResolvedValue({ ...unapprovedJob });
    const { terraformApply } = await import("../runner");
    const result = await terraformApply("job-1");

    expect(result.blockedByKillSwitch).toBe(true);
    expect(result.output).not.toMatch(/CONFIRM APPLY/);
  });

  it("falls through to the normal approval check once the flag is explicitly enabled", async () => {
    vi.stubEnv("TERRAFORM_LEGACY_APPLY_ENABLED", "true");
    mocks.findJob.mockResolvedValue({ ...unapprovedJob });
    const { terraformApply } = await import("../runner");
    const result = await terraformApply("job-1");

    // Flag is on, so the kill-switch no longer fires — the pre-existing
    // approval gate is reached instead (job here is deliberately
    // unapproved, so it still refuses, just for a different reason).
    expect(result.blockedByKillSwitch).toBeUndefined();
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/CONFIRM APPLY/);
  });
});
