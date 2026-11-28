// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executeReadOnlyTool, type ToolExecutionRepo } from "../toolExecution";

describe("read_deployment_checks_workflow", () => {
  it("returns the generated workflow for the workspace's checks, read-only", async () => {
    const findMany = vi.fn(async (_args: { where: { organizationId: string } }) => [{ key: "health", name: "Health", kind: "smoke_test", stage: "verify", mode: "blocking", enabled: true, version: 1, spec: { url: "https://app.example.test/health", expectStatus: 200, maxLatencyMs: 500 } }]);
    const repo = { deploymentCheck: { findMany } } as unknown as ToolExecutionRepo;
    const r = await executeReadOnlyTool(repo, "org_1", "read_deployment_checks_workflow", {});
    expect(r.ok).toBe(true);
    const out = (r as { result: { kind: string; path: string; yaml: string; included: string[] } }).result;
    expect(out.kind).toBe("generated_workflow");
    expect(out.path).toBe(".github/workflows/v19-deployment-checks.yml");
    expect(out.yaml).toContain("health");
    expect(out.included).toEqual(["health"]);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({ organizationId: "org_1" });
  });
  it("reports unavailable checks plainly", async () => {
    const repo = { deploymentCheck: { findMany: vi.fn(async () => { throw new Error("db"); }) } } as unknown as ToolExecutionRepo;
    expect(await executeReadOnlyTool(repo, "org_1", "read_deployment_checks_workflow", {})).toEqual({ ok: false, error: "checks_unavailable" });
  });
});
