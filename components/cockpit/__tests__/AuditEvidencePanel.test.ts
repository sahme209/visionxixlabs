/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuditEvidencePanel, type AuditEvidenceRecord } from "../AuditEvidencePanel";
afterEach(cleanup);
const rows: AuditEvidenceRecord[] = Array.from({ length: 21 }, (_, index) => ({ id: `audit-${index}`, action: `test.action.${index}`, outcome: index === 20 ? "blocked" : "success", actorKind: "user", actorUserId: "local-fixture", entityRef: `item-${index}`, correlationId: `full-correlation-reference-${index}`, source: "live", occurredAt: "2026-10-22T12:00:00.000Z", errorCode: null }));
it("pages the loaded records and resets paging when outcome changes", () => {
  render(createElement(AuditEvidencePanel, { records: rows }));
  expect(screen.getByText("test.action.0")).toBeTruthy();
  expect(screen.queryByText("test.action.20")).toBeNull();
  expect((screen.getByRole("button", { name: "Previous audit page" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next audit page" }));
  expect(screen.getByText("test.action.20")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Next audit page" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "Audit outcome" }), { target: { value: "success" } });
  expect(screen.getByText("test.action.0")).toBeTruthy();
  expect(screen.queryByText("test.action.20")).toBeNull();
});
it("searches complete correlation references and combines the outcome filter", () => {
  render(createElement(AuditEvidencePanel, { records: rows }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search loaded audit records" }), { target: { value: "full-correlation-reference-20" } });
  expect(screen.getByText("test.action.20")).toBeTruthy();
  expect(screen.queryByText("test.action.0")).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Audit outcome" }), { target: { value: "failure" } });
  expect(screen.getByText("No matching audit records.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear audit filters" }));
  expect(screen.getByText("test.action.0")).toBeTruthy();
});
it("distinguishes a verified empty audit from a filtered result", () => {
  render(createElement(AuditEvidencePanel, { records: [] }));
  expect(screen.getByText("No audit records have been written for this organization.")).toBeTruthy();
  expect(screen.queryByText("No matching audit records.")).toBeNull();
});
