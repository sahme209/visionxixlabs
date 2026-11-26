import { describe, expect, it } from "vitest";
import { previewImpact } from "@/lib/impact/impactKernel";
import { triageRequest } from "../reviewTriage";

const req = (actionKind: never | string, environment: string, decision: string, riskLevel: string, files?: string[]) =>
  triageRequest({ actionKind: actionKind as never, environment: environment as never, policy: { decision: decision as never, riskLevel: riskLevel as never }, impact: files ? previewImpact(files) : null });

describe("review triage by blast radius", () => {
  it("follows policy for allowed and refused actions", () => {
    expect(req("read", "development", "allow", "low").lane).toBe("auto");
    expect(req("secret_access", "production", "deny", "high")).toMatchObject({ lane: "refused", approvalsRequired: 0 });
  });
  it("gives contained non-production changes a quick look", () => {
    expect(req("merge", "staging", "require_approval", "medium", ["src/app/page.tsx"])).toMatchObject({ lane: "quick", approvalsRequired: 1, reason: "Contained change to 1 file outside production." });
  });
  it("sends production and risky changes to careful review", () => {
    expect(req("deploy", "production", "require_approval", "high", ["src/app/page.tsx"])).toMatchObject({ lane: "careful", approvalsRequired: 1 });
    expect(req("deploy", "staging", "require_approval", "high")).toMatchObject({ lane: "careful" });
  });
  it("requires two approvers for wide or sensitive production changes and destructive production kinds", () => {
    expect(req("deploy", "production", "require_approval", "high", ["prisma/migrations/1/migration.sql"])).toMatchObject({ lane: "two_person", approvalsRequired: 2, reason: expect.stringContaining("database migration") });
    expect(req("delete_resource", "production", "require_approval", "high")).toMatchObject({ lane: "two_person", reason: expect.stringContaining("delete resource") });
    const wide = Array.from({ length: 120 }, (_, i) => `pkg${i % 12}/src/file${i}.ts`);
    expect(req("merge", "production", "require_approval", "high", wide).lane).toBe("two_person");
  });
});
