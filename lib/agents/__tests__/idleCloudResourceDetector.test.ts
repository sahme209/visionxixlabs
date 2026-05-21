import { describe, it, expect, beforeEach } from "vitest";
import {
  detectIdleResources,
  summarizeIdle,
  __resetIdleCounter,
  type IdleResourceInput,
} from "../idleCloudResourceDetector";

function r(overrides: Partial<IdleResourceInput> & { id: string; kind: IdleResourceInput["kind"]; daysIdle: number; monthlyUsd: number }): IdleResourceInput {
  return {
    region: "us-east-1",
    hasProductionTag: false,
    hasBackup: false,
    ...overrides,
  };
}

beforeEach(() => __resetIdleCounter());

describe("detectIdleResources", () => {
  it("EIP unattached past threshold → delete_immediately", () => {
    const r1 = r({ id: "eip-1", kind: "elastic_ip_unattached", daysIdle: 30, monthlyUsd: 3.6 });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("delete_immediately");
    expect(out[0].monthlySavingsUsd).toBe(3.6);
  });

  it("EIP within threshold → keep", () => {
    const r1 = r({ id: "eip-2", kind: "elastic_ip_unattached", daysIdle: 3, monthlyUsd: 3.6 });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("keep");
  });

  it("EBS without backup → snapshot_then_delete", () => {
    const r1 = r({ id: "ebs-1", kind: "ebs_volume_unattached", daysIdle: 30, monthlyUsd: 10, hasBackup: false });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("snapshot_then_delete");
    if (out[0].recommendation.kind === "snapshot_then_delete") {
      expect(out[0].recommendation.snapshotRetentionDays).toBe(30);
    }
  });

  it("EBS with backup → delete_immediately", () => {
    const r1 = r({ id: "ebs-2", kind: "ebs_volume_unattached", daysIdle: 30, monthlyUsd: 10, hasBackup: true });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("delete_immediately");
  });

  it("Production-tagged resource never auto-deletes", () => {
    const r1 = r({ id: "ebs-3", kind: "ebs_volume_unattached", daysIdle: 60, monthlyUsd: 50, hasProductionTag: true });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("tag_for_review");
    expect(out[0].monthlySavingsUsd).toBe(0); // We don't claim savings until human approves.
  });

  it("Old snapshot → delete_immediately", () => {
    const r1 = r({ id: "snap-1", kind: "snapshot_old", daysIdle: 365, monthlyUsd: 5 });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("delete_immediately");
  });

  it("Dormant lambda → tag_for_review (never auto-delete)", () => {
    const r1 = r({ id: "lam-1", kind: "lambda_dormant", daysIdle: 120, monthlyUsd: 0 });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("tag_for_review");
  });

  it("Idle RDS → downsize, ~50% saving", () => {
    const r1 = r({ id: "rds-1", kind: "rds_idle", daysIdle: 60, monthlyUsd: 200 });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("downsize");
    expect(out[0].monthlySavingsUsd).toBe(100);
  });

  it("ELB with no targets → delete_immediately", () => {
    const r1 = r({ id: "elb-1", kind: "elb_no_targets", daysIdle: 30, monthlyUsd: 18 });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("delete_immediately");
  });

  it("Empty bucket → tag_for_review (name-squatting risk)", () => {
    const r1 = r({ id: "s3-1", kind: "s3_bucket_empty", daysIdle: 90, monthlyUsd: 0 });
    const out = detectIdleResources([r1]);
    expect(out[0].verdict).toBe("tag_for_review");
    expect(out[0].rationale).toMatch(/name-squatting/i);
  });

  it("Findings sorted by savings descending", () => {
    const items = [
      r({ id: "small", kind: "ebs_volume_unattached", daysIdle: 30, monthlyUsd: 5, hasBackup: true }),
      r({ id: "big",   kind: "ebs_volume_unattached", daysIdle: 30, monthlyUsd: 100, hasBackup: true }),
    ];
    const out = detectIdleResources(items);
    expect(out[0].resourceId).toBe("big");
    expect(out[1].resourceId).toBe("small");
  });

  it("summarizeIdle aggregates total savings + verdict counts", () => {
    const items = [
      r({ id: "a", kind: "elastic_ip_unattached", daysIdle: 30, monthlyUsd: 3.6 }),
      r({ id: "b", kind: "elastic_ip_unattached", daysIdle: 30, monthlyUsd: 3.6 }),
      r({ id: "c", kind: "elastic_ip_unattached", daysIdle: 3, monthlyUsd: 3.6 }), // keep
    ];
    const out = detectIdleResources(items);
    const s = summarizeIdle(out);
    expect(s.totalFindings).toBe(3);
    expect(s.byVerdict.delete_immediately).toBe(2);
    expect(s.byVerdict.keep).toBe(1);
    expect(s.totalMonthlySavingsUsd).toBe(7.2);
  });
});
