/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AIGovernancePanel } from "../../../app/control/ai-agents/AIGovernancePanel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each([true, false])("shows effective saved-policy profile permissions when Agent enabled=%s without granting editing authority", async enabled => {
  const fetcher = vi.fn(async () => Response.json({ ok: true, data: {
    canManage: false, availableProviders: [], gatewayModels: [], gatewayCatalogLive: false,
    providerPolicy: { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] },
    agentIdentity: { displayName: "Workspace Agent", enabled, allowedTools: ["read_github_file", "commit_github_file", "trigger_aws_deploy"], updatedAt: "2026-10-20" },
    autonomy: null, budget: null, tools: [],
  } }));
  vi.stubGlobal("fetch", fetcher); render(createElement(AIGovernancePanel));
  fireEvent.click(await screen.findByRole("tab", { name: "Agent profiles" }));
  const section = await screen.findByRole("region", { name: "Effective specialized Agent permissions" });
  const review = within(section).getByText("Code Review Agent").closest("details")!;
  expect(within(review).queryByText("commit_github_file")).toBeNull();
  expect(within(review).queryByText("trigger_aws_deploy")).toBeNull();
  if (enabled) expect(within(review).getByText("read_github_file")).toBeTruthy();
  else expect(within(section).queryAllByText("read_github_file")).toHaveLength(0);
  fireEvent.click(screen.getByRole("tab", { name: "Configuration" }));
  expect((screen.getByRole("button", { name: "Save identity" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/control/ai-governance", { cache: "no-store" });
});
