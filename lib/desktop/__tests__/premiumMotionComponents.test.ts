/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrendSparkline, bucketDate } from "../../../desktop/src/components/motion/TrendSparkline";
import { AnimatedNumber } from "../../../desktop/src/components/motion/AnimatedNumber";
import { AirflowDependencyGraph } from "../../../desktop/src/components/AirflowDependencyGraph";
import type { AirflowAutomation } from "../../../desktop/src/lib/desktopClient";
afterEach(cleanup);

it("renders the recorded value immediately when motion is unavailable", () => {
  render(createElement(AnimatedNumber, { value: 1234 }));
  expect(screen.getByText("1,234")).toBeTruthy();
});

it("reads each day of the sparkline with arrow keys, newest first by default", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  render(createElement(TrendSparkline, { values: [1, 0, 3], unit: ["run", "runs"], label: "Runs per day", now }));
  const chart = screen.getByRole("img", { name: /Runs per day/ });
  expect(chart.getAttribute("aria-label")).toContain("Nov 26: 3 runs");
  fireEvent.keyDown(chart, { key: "ArrowLeft" });
  expect(chart.getAttribute("aria-label")).toContain("Nov 25: 0 runs");
  fireEvent.keyDown(chart, { key: "Home" });
  expect(chart.getAttribute("aria-label")).toContain("Nov 24: 1 run.");
  expect(bucketDate(29, 30, now).toISOString()).toBe("2026-11-26T00:00:00.000Z");
});

const base = { enabled: true, triggerMode: "dag_success", scheduleCron: null, requiredDagState: "success", actionType: "deploy", repositoryFullName: null, sourceRef: null, pullRequestBase: null, pullRequestTitle: null, environmentId: null, approvalRequired: true, maxRetries: 0, retryDelaySeconds: 0, lastEvaluatedAt: null, nextScheduledAt: null };
it("traces a DAG's saved dependencies on focus and dims unrelated paths", () => {
  const automations = [
    { ...base, id: "a", name: "A", dagId: "deploy_api", dependencyDagIds: ["etl_orders"] },
    { ...base, id: "b", name: "B", dagId: "deploy_web", dependencyDagIds: ["etl_users"] },
  ] as AirflowAutomation[];
  render(createElement(AirflowDependencyGraph, { automations }));
  fireEvent.focus(screen.getByRole("button", { name: "Automation DAG deploy_api" }));
  expect(screen.getByRole("status").textContent).toBe("deploy_api waits for etl_orders");
  expect(screen.getByRole("button", { name: "Upstream DAG etl_users" }).getAttribute("data-lit")).toBe("false");
  expect(screen.getByRole("button", { name: "Upstream DAG etl_orders" }).getAttribute("data-lit")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(document.querySelector(".airflow-dependency-canvas")?.getAttribute("transform")).toContain("scale(1.2)");
});
