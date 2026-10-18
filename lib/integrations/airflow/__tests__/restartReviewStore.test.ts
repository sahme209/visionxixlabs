import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { restartReviewReadiness, AIRFLOW_REVIEW_PROPOSAL_CHECKSUM } from "../restartReviewStore";
it("pins proposed-only SQL bytes outside automatic migrations", () => {
  expect(createHash("sha256").update(readFileSync("docs/proposals/airflow-execution-review-v1.sql")).digest("hex")).toBe(AIRFLOW_REVIEW_PROPOSAL_CHECKSUM);
});
it("does not select optional artifact columns on legacy installations", async () => {
  const query = vi.fn().mockResolvedValue([{ feature: false, review: false }]);
  expect(await restartReviewReadiness({ $queryRawUnsafe: query })).toBe("not_installed");
  expect(query).toHaveBeenCalledTimes(1);
});
it.each([{ feature: true, review: false }, { feature: false, review: true }])("rejects partial feature storage %j", async tables => {
  expect(await restartReviewReadiness({ $queryRawUnsafe: vi.fn().mockResolvedValue([tables]) })).toBe("drift");
});
it("does not silently adopt unmarked storage or trust an unavailable catalog", async () => {
  const query = vi.fn().mockResolvedValueOnce([{ feature: true, review: true }]).mockResolvedValueOnce([]);
  expect(await restartReviewReadiness({ $queryRawUnsafe: query })).toBe("drift");
  expect(await restartReviewReadiness({ $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("offline")) })).toBe("unavailable");
});
