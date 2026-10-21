import { expect, it } from "vitest";
import { auditPreviewMetadata } from "../../../scripts/audit-vercel-preview-metadata.mjs";
it("projects only metadata and never certifies deployment safety", () => {
 const result = auditPreviewMetadata({ hiddenProductionEnvCount: 0, envs: [{ key: "DATABASE_URL", target: ["production", "preview"], value: "sensitive-fixture", comment: "private-fixture" }] });
 expect(result.complete).toBe(true); expect(result.sharedProductionPreview).toEqual(["DATABASE_URL"]); expect(result.deploymentAuthorized).toBe(false);
 expect(JSON.stringify(result)).not.toContain("sensitive-fixture"); expect(JSON.stringify(result)).not.toContain("private-fixture");
});
it("detects literal connector truncation instead of certifying the visible prefix", () => {
 expect(auditPreviewMetadata({ hiddenProductionEnvCount: 0, envs: [{ key: "SAFE_NAME", target: ["preview"] }, { key: "...[truncated]", target: ["...[truncated]"] }] }).complete).toBe(false);
});
it.each([{ hiddenProductionEnvCount: 2 }, { pagination: { next: "cursor" } }, { envs: [{ key: "SHARED_KEY", target: ["preview"], sharedEnvVariableId: "reference" }] }])("retains hidden, paginated or shared inventory gaps %j", (override) => {
 expect(auditPreviewMetadata({ hiddenProductionEnvCount: 0, envs: [], ...override }).complete).toBe(false);
});

it.each(["...[truncated]", [], { hasMore: "false" }, { next: "...[truncated]" }])("rejects malformed or redacted pagination %j", (pagination) => {
 expect(auditPreviewMetadata({ hiddenProductionEnvCount: 0, envs: [], pagination }).complete).toBe(false);
});
it("keeps deployment authority false for invalid inventory too", () => {
 expect(auditPreviewMetadata(null)).toMatchObject({ complete: false, deploymentAuthorized: false });
});
