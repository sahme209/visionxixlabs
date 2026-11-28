// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executeReadOnlyTool, type ToolExecutionRepo } from "../toolExecution";

const row = { key: "failed-deploy", title: "A deploy failed", trigger: "deployment_failed", version: 2, steps: [{ title: "Roll back", detail: "Use the desktop app.", approval: "one_admin" }] };

describe("list_workspace_runbooks", () => {
  it("lists the workspace's enabled runbooks, optionally by trigger, read-only", async () => {
    const findMany = vi.fn(async (_args: { where: Record<string, unknown> }) => [row, { ...row, key: "broken", steps: [] }]);
    const repo = { workspaceRunbook: { findMany } } as unknown as ToolExecutionRepo;
    const r = await executeReadOnlyTool(repo, "org_1", "list_workspace_runbooks", { trigger: "deployment_failed" });
    expect(r.ok && (r as { result: { runbooks: Array<{ key: string }> } }).result.runbooks.map((x) => x.key)).toEqual(["failed-deploy"]);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({ organizationId: "org_1", enabled: true, trigger: "deployment_failed" });
  });
  it("refuses unknown filters and reports unavailability plainly", async () => {
    const repo = { workspaceRunbook: { findMany: vi.fn(async () => { throw new Error("db"); }) } } as unknown as ToolExecutionRepo;
    expect(await executeReadOnlyTool(repo, "org_1", "list_workspace_runbooks", { trigger: "anything" })).toEqual({ ok: false, error: "invalid_runbook_filter" });
    expect(await executeReadOnlyTool(repo, "org_1", "list_workspace_runbooks", { key: "x" })).toEqual({ ok: false, error: "invalid_runbook_filter" });
    expect(await executeReadOnlyTool(repo, "org_1", "list_workspace_runbooks", {})).toEqual({ ok: false, error: "runbooks_unavailable" });
  });
});
