/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AirflowDependencyGraph, buildDependencyGraph } from "../../../desktop/src/components/AirflowDependencyGraph";
import type { AirflowAutomation } from "../../../desktop/src/lib/desktopClient";
afterEach(cleanup);
const base = { enabled: true, triggerMode: "dag_success", scheduleCron: null, requiredDagState: "success", actionType: "deploy", repositoryFullName: null, sourceRef: null, pullRequestBase: null, pullRequestTitle: null, environmentId: null, approvalRequired: true, maxRetries: 0, retryDelaySeconds: 0, lastEvaluatedAt: null, nextScheduledAt: null };
const automation = (id: string, dagId: string, deps: string[], enabled = true): AirflowAutomation => ({ ...base, id, name: `Auto ${id}`, dagId, dependencyDagIds: deps, enabled });

it("builds edges only from saved dependency DAG ids, de-duplicated", () => {
  const graph = buildDependencyGraph([automation("a", "deploy_api", ["etl_orders", "etl_users", "etl_orders"]), automation("b", "deploy_web", ["etl_users"]), automation("c", "nightly", [])]);
  expect(graph.sources).toEqual(["etl_orders", "etl_users"]);
  expect(graph.targets.map((t) => t.dagId)).toEqual(["deploy_api", "deploy_web"]);
  expect(graph.edges).toEqual([{ from: 0, to: 0 }, { from: 1, to: 0 }, { from: 1, to: 1 }]);
});

it("renders nothing when no automation has saved dependencies", () => {
  const { container } = render(createElement(AirflowDependencyGraph, { automations: [automation("c", "nightly", [])] }));
  expect(container.firstChild).toBeNull();
});

it("labels the graph as configured edges and marks paused automations", () => {
  render(createElement(AirflowDependencyGraph, { automations: [automation("a", "deploy_api", ["etl_orders"], false)] }));
  const figure = screen.getByRole("figure", { name: "Saved automation dependencies" });
  expect(figure.textContent).toContain("not live readiness");
  expect(figure.querySelector('[data-kind="automation"]')?.getAttribute("data-enabled")).toBe("false");
  expect(figure.textContent).toContain("paused");
  expect(figure.querySelector("desc")?.textContent).toBe("etl_orders before deploy_api");
});

it("ignores automations whose saved dependency list is missing or malformed", () => {
  const legacy = { ...automation("x", "legacy", []), dependencyDagIds: undefined } as unknown as AirflowAutomation;
  const graph = buildDependencyGraph([legacy, { ...automation("y", "odd", []), dependencyDagIds: ["", 4, "etl"] } as unknown as AirflowAutomation]);
  expect(graph.sources).toEqual(["etl"]);
  expect(graph.targets.map((t) => t.dagId)).toEqual(["odd"]);
});
