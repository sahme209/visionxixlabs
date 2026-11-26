/** @vitest-environment jsdom */
// Structural accessibility checks (axe-core, WCAG 2 A/AA) for the interactive components added on 26 Nov.
// Colour contrast needs a real browser and is covered by the browser axe pass, so it is disabled here.
import { createElement, type ReactElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { DataBoundaryDiagram } from "../DataBoundaryDiagram";
import { ArchitectureMap } from "../ArchitectureMap";
import { ReleaseRiskRadar } from "../../../desktop/src/components/ReleaseRiskRadar";
import { ChangeWindowTimeline } from "../../../desktop/src/components/ChangeWindowTimeline";
import { AirflowTaskWaterfall } from "../../../desktop/src/components/AirflowTaskWaterfall";
import { TrendSparkline } from "../../../desktop/src/components/motion/TrendSparkline";
afterEach(cleanup);

async function violations(element: ReactElement) {
  const { container } = render(createElement("main", null, element));
  const result = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`);
}

const context = {
  window: { startUtc: "2026-11-26T10:00:00Z", endUtc: "2026-11-26T12:00:00Z", displayTimeZone: "UTC" },
  scope: { applicationCount: 1, repositoryCount: 1, targetEnvironment: "production" },
  approval: { prStatus: "pending", noPrRequired: false },
  readiness: { developmentReady: true, productionReady: false, validationStepCount: 1, deferredValidation: false, approvalDecision: "needs_attention" as const, blockers: [] },
  recovery: { rollbackAvailability: "yes", backupRequired: false, evidenceCount: 0 },
  observation: { status: "not_connected" as const, recordedMonitoringPlan: true },
};

it.each([
  ["data boundary diagram", () => createElement(DataBoundaryDiagram)],
  ["architecture map", () => createElement(ArchitectureMap)],
  ["release risk radar", () => createElement(ReleaseRiskRadar, { context, now: new Date("2026-11-26T09:00:00Z") })],
  ["change window timeline", () => createElement(ChangeWindowTimeline, { window: context.window, now: new Date("2026-11-26T11:00:00Z") })],
  ["task waterfall", () => createElement(AirflowTaskWaterfall, { tasks: [
    { taskId: "a", mapIndex: -1, tryNumber: 1, state: "success", startedAt: "2026-11-17T10:00:00Z", endedAt: "2026-11-17T10:01:00Z" },
    { taskId: "b", mapIndex: -1, tryNumber: 1, state: "running", startedAt: "2026-11-17T10:01:00Z", endedAt: null },
  ] })],
  ["trend sparkline", () => createElement(TrendSparkline, { values: [1, 2, 3], unit: ["run", "runs"] as [string, string], label: "Runs per day" })],
])("%s has no structural axe violations", async (_name, make) => {
  expect(await violations(make())).toEqual([]);
});
