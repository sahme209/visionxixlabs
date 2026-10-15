import { describe, expect, it } from "vitest";
import { scheduledDagRunId } from "../scheduledRunId";

describe("scheduled Airflow run identity", () => {
  const input = { organizationId: "org-1", automationId: "rule-1", dagId: "daily", scheduledAt: new Date("2026-10-15T10:00:00Z") };
  it("is stable for the same tenant, rule, DAG and scheduled occurrence", () => {
    expect(scheduledDagRunId(input)).toBe(scheduledDagRunId({ ...input, scheduledAt: new Date(input.scheduledAt) }));
    expect(scheduledDagRunId(input)).toMatch(/^axiom_schedule__[a-f0-9]{64}$/);
  });
  it.each([{ organizationId: "org-2" }, { automationId: "rule-2" }, { dagId: "other" }, { scheduledAt: new Date("2026-10-16T10:00:00Z") }])("separates occurrence identity %j", (change) => {
    expect(scheduledDagRunId({ ...input, ...change })).not.toBe(scheduledDagRunId(input));
  });
});
