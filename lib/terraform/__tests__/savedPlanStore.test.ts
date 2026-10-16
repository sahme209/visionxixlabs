import { describe, expect, it, vi } from "vitest";
import { readSavedPlanStorageReadiness, listSavedPlanRecords, SAVED_PLAN_PROPOSAL_CHECKSUM } from "../savedPlanStore";
import { bytesDigest } from "../savedPlanArtifact";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("optional Terraform artifact storage", () => {
  it("pins the exact review-only SQL proposal", () => {
    expect(bytesDigest(readFileSync(resolve("docs/proposals/terraform-saved-plan-storage-v1.sql")))).toBe(SAVED_PLAN_PROPOSAL_CHECKSUM);
  });
  it("returns not installed without querying absent artifact columns", async () => {
    const query = vi.fn().mockResolvedValue([{ feature: false, artifact: false }]);
    expect(await readSavedPlanStorageReadiness({ $queryRawUnsafe: query })).toBe("not_installed");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toMatch(/SELECT \* FROM/);
  });
  it.each([{ feature: true, artifact: false }, { feature: false, artifact: true }])("rejects partial storage %j", async (catalog) => {
    const query = vi.fn().mockResolvedValue([catalog]);
    expect(await readSavedPlanStorageReadiness({ $queryRawUnsafe: query })).toBe("drift");
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("does not adopt tables with no matching installer marker", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ feature: true, artifact: true }]).mockResolvedValueOnce([]);
    expect(await readSavedPlanStorageReadiness({ $queryRawUnsafe: query })).toBe("drift");
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("fails closed on an unavailable catalog", async () => {
    expect(await readSavedPlanStorageReadiness({ $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("no database")) })).toBe("unavailable");
  });
  it("bounds rows and selects only the exact tenant/request using SQL parameters", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await listSavedPlanRecords({ $queryRawUnsafe: query }, { organizationId: "foreign' OR 1=1", requestId: "request" });
    expect(query.mock.calls[0][0]).toContain('"organizationId"=$1 AND "deploymentRequestId"=$2');
    expect(query.mock.calls[0][0]).toContain("LIMIT 21");
    expect(query.mock.calls[0][0]).not.toMatch(/encryptedBinary|encryptedShow/);
    expect(query.mock.calls[0].slice(1)).toEqual(["foreign' OR 1=1", "request"]);
  });
});
