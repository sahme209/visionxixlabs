import { describe, expect, it } from "vitest";
import { checkEvidenceCoverage } from "../checkEvidenceCoverage";

describe("checkEvidenceCoverage", () => {
  it("counts deployments with all checks passed, any failed, or missing evidence", () => {
    const r = (checkKey: string, releaseRef: string, status: string) => ({ checkKey, releaseRef, status });
    const out = checkEvidenceCoverage(["a", "b", "c", null], ["smoke", "migrate"], [r("smoke", "a", "passed"), r("migrate", "a", "passed"), r("smoke", "b", "failed"), r("migrate", "b", "passed"), r("smoke", "c", "passed")]);
    expect(out).toEqual({ deployments: 4, allPassed: 1, anyFailed: 1, missing: 2 });
  });
  it("treats every deployment as passing when no checks are blocking", () => {
    expect(checkEvidenceCoverage(["a"], [], [])).toEqual({ deployments: 1, allPassed: 1, anyFailed: 0, missing: 0 });
  });
});
