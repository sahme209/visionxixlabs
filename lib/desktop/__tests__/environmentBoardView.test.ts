/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { EnvironmentBoard } from "../../../desktop/src/components/EnvironmentBoard";
import { desktopClient, type DeploymentExecution } from "../../../desktop/src/lib/desktopClient";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const exec = (id: string, environmentId: string, conclusion: string | null): DeploymentExecution => ({ id, environmentId, repositoryFullName: "org/api", sourceRef: "main", sourceKind: "branch", sourceCommitSha: "abc1234def", branchPolicyId: null, pullRequestUrl: null, workflowRunId: null, workflowUrl: null, source: "desktop", status: "completed", conclusion, rollbackStatus: "not_started", lastObservedAt: null, completedAt: "2026-11-20T10:00:00Z", createdAt: "2026-11-20T09:50:00Z", updatedAt: "2026-11-20T10:00:00Z" });

it("shows the latest recorded run per environment in lifecycle order and says it is not the live version", async () => {
  vi.spyOn(desktopClient, "listEnvironments").mockResolvedValue({ ok: true, data: { environments: [
    { id: "p", slug: "prod", name: "Production", tier: "production", displayOrder: 2, hasApprovalPolicy: true, createdAtIso: "2026-01-01T00:00:00Z" },
    { id: "s", slug: "stg", name: "Staging", tier: "staging", displayOrder: 1, hasApprovalPolicy: false, createdAtIso: "2026-01-01T00:00:00Z" },
  ] } });
  render(createElement(EnvironmentBoard, { executions: [exec("1", "s", "success"), exec("2", "p", "failure")] }));
  const region = await screen.findByRole("region", { name: "Environment board" });
  expect(region.textContent).toContain("not the live deployed version");
  const headers = within(region).getAllByRole("columnheader").map((h) => h.textContent);
  expect(headers).toEqual(["Repository", "Staging", "Production"]);
  const cells = region.querySelectorAll(".environment-board-cell");
  expect([...cells].map((c) => c.getAttribute("data-tone"))).toEqual(["green", "red"]);
});

it("stays hidden when environments cannot be read", async () => {
  vi.spyOn(desktopClient, "listEnvironments").mockResolvedValue({ ok: false, error: "unavailable" } as never);
  const { container } = render(createElement(EnvironmentBoard, { executions: [exec("1", "s", "success")] }));
  await new Promise((r) => setTimeout(r, 0));
  expect(container.firstChild).toBeNull();
});
