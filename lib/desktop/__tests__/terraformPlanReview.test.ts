/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DesktopClient, desktopClient } from "../../../desktop/src/lib/desktopClient";
import { TerraformPlanReview } from "../../../desktop/src/components/TerraformPlanReview";
import type { SavedPlanReadData } from "../../terraform/savedPlanDto";

const metadata = { id: "artifact", binaryDigest: "a".repeat(64), binaryBytes: 1543, environmentId: "fixture-target", requestVersion: 1, terraformVersion: "1.9.8", createdAt: "2026-10-16T12:00:00Z", expiresAt: "2026-10-16T13:00:00Z", evidenceScope: "owned_local_fixture" as const, inspection: "metadata_only" as const, approval: "unavailable" as const, currentTarget: "unavailable" as const, executionEnabled: false as const };
const listData = (): SavedPlanReadData => ({ plans: [metadata], truncated: false, producer: "unavailable", executionEnabled: false });
beforeEach(() => { desktopClient.setSession("fixture-paired-token"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); desktopClient.setSession(undefined); });

it("isolates session subscribers and advances revision without exposing a credential", () => {
  const client = new DesktopClient(); const observed: unknown[] = [];
  const off = client.subscribeContext(() => { throw new Error("view failed"); });
  const offSecond = client.subscribeContext(() => observed.push(client.getContextRevision()));
  const original = client.getContextRevision();
  client.setSession("private-fixture-token"); client.setApiBase("https://fixture.test");
  expect(observed).toEqual([original + 1, original + 2]);
  off(); offSecond(); client.setSession(undefined); expect(observed).toHaveLength(2);
});
it("reads metadata and explicitly inspects one sanitized artifact without execution controls", async () => {
  vi.spyOn(desktopClient, "listDeploymentTerraformPlans").mockResolvedValue({ ok: true, data: listData() });
  vi.spyOn(desktopClient, "getDeploymentTerraformPlan").mockResolvedValue({ ok: true, data: { ...listData(), plans: [{ ...metadata, inspection: "artifact_bytes_checked", summary: { rows: [], counts: { create: 1, update: 0, delete: 0, replace: 0, read: 0, "no-op": 0 }, byProvider: [], destructive: [], severity: "low" } }] } });
  render(createElement(TerraformPlanReview, { requestId: "request", requestVersion: 1 }));
  fireEvent.click(screen.getByRole("button", { name: "Read saved plan metadata" }));
  fireEvent.click(await screen.findByRole("button", { name: /Inspect aaaaaaaaaaaa/ }));
  expect(await screen.findByText("1 create · 0 update · 0 delete · 0 replace")).not.toBeNull();
  expect(screen.getByText(/Approval and current backend\/target authority are unavailable/)).not.toBeNull();
  expect(screen.queryByRole("button", { name: /apply|approve|upload|regenerate/i })).toBeNull();
});
it("drops a late list response after the selected request changes", async () => {
  let finish!: (v: { ok: true; data: SavedPlanReadData }) => void;
  vi.spyOn(desktopClient, "listDeploymentTerraformPlans").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(createElement(TerraformPlanReview, { requestId: "old", requestVersion: 1 }));
  fireEvent.click(screen.getByRole("button", { name: "Read saved plan metadata" }));
  view.rerender(createElement(TerraformPlanReview, { requestId: "new", requestVersion: 1 }));
  await act(async () => finish({ ok: true, data: listData() }));
  expect(screen.queryByRole("button", { name: /Inspect aaaaaaaaaaaa/ })).toBeNull();
});
it("clears visible metadata synchronously on credential change and ignores a late detail", async () => {
  vi.spyOn(desktopClient, "listDeploymentTerraformPlans").mockResolvedValue({ ok: true, data: listData() });
  let finish!: (v: { ok: true; data: SavedPlanReadData }) => void;
  vi.spyOn(desktopClient, "getDeploymentTerraformPlan").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(createElement(TerraformPlanReview, { requestId: "request", requestVersion: 1 }));
  fireEvent.click(screen.getByRole("button", { name: "Read saved plan metadata" }));
  fireEvent.click(await screen.findByRole("button", { name: /Inspect aaaaaaaaaaaa/ }));
  act(() => desktopClient.setSession("different-workspace-token"));
  expect(screen.queryByRole("button", { name: /Inspect aaaaaaaaaaaa/ })).toBeNull();
  await act(async () => finish({ ok: true, data: listData() }));
  expect(screen.queryByText("fixture-target")).toBeNull();
});
it("explains unavailable storage without displaying raw failure payloads", async () => {
  vi.spyOn(desktopClient, "listDeploymentTerraformPlans").mockResolvedValue({ ok: false, error: "saved_plan_storage_not_installed SECRET" });
  render(createElement(TerraformPlanReview, { requestId: "request", requestVersion: 1 }));
  fireEvent.click(screen.getByRole("button", { name: "Read saved plan metadata" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Saved plan evidence is unavailable. Ask your workspace administrator to review artifact storage and the trusted plan producer.");
  expect(screen.queryByText(/SECRET/)).toBeNull();
});
