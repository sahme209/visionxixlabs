import { expect, it } from "vitest";
import { releaseAirflowDependencySchema } from "../releaseDependencySchema";
const dependency = { connectionId: "connection", connectionUpdatedAt: "2026-10-24T00:00:00.000Z", runs: [{ dagId: "daily", dagRunId: "scheduled__run", logicalDate: "2026-10-24T00:00:00.000001Z" }] };
it("preserves exact run precision and connection revision without accepting execution authority", () => {
  expect(releaseAirflowDependencySchema.parse(dependency)).toEqual(dependency);
  expect(releaseAirflowDependencySchema.safeParse({ ...dependency, approved: true }).success).toBe(false);
});
it.each([{ runs: [] }, { runs: [...dependency.runs, ...dependency.runs] }, { runs: [{ ...dependency.runs[0], logicalDate: "2026-10-24" }] }, { connectionUpdatedAt: "yesterday" }, { runs: [{ ...dependency.runs[0], dagRunId: "" }] }, { runs: Array.from({ length: 26 }, (_, i) => ({ ...dependency.runs[0], dagRunId: String(i) })) }])("rejects incomplete or ambiguous binding", patch => {
  expect(releaseAirflowDependencySchema.safeParse({ ...dependency, ...patch }).success).toBe(false);
});
