/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReleaseRiskRadar } from "../../../desktop/src/components/ReleaseRiskRadar";
afterEach(cleanup);

it("lists every axis with its recorded basis and highlights the focused one", () => {
  render(createElement(ReleaseRiskRadar, { now: new Date("2026-11-26T00:00:00Z"), context: {
    window: null,
    scope: { applicationCount: 1, repositoryCount: 1, targetEnvironment: "production" },
    approval: { prStatus: "pending", noPrRequired: false },
    readiness: { developmentReady: true, productionReady: false, validationStepCount: 2, deferredValidation: false, approvalDecision: "needs_attention", blockers: ["x"] },
    recovery: { rollbackAvailability: "no", backupRequired: false, evidenceCount: 0 },
    observation: { status: "not_connected", recordedMonitoringPlan: false },
  } }));
  const region = screen.getByRole("region", { name: "Release risk radar" });
  expect(region.textContent).toContain("Not a prediction or an approval");
  const items = within(screen.getByRole("list", { name: "Radar axes" })).getAllByRole("listitem");
  expect(items).toHaveLength(7);
  const recovery = items.find((li) => li.textContent?.includes("Recovery"))!;
  expect(recovery.getAttribute("data-level")).toBe("gap");
  expect(recovery.textContent).toContain("No rollback planned");
  fireEvent.focus(recovery);
  expect(recovery.getAttribute("data-active")).toBe("true");
  expect(region.textContent).toMatch(/\d gap/);
});
