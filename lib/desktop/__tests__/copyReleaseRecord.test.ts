/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CopyReleaseRecord, releaseRecordJson } from "../../../desktop/src/components/CopyReleaseRecord";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const request = { id: "rel_1", version: 3, title: "Payments API", status: "submitted", correlationId: "corr_1", submittedAt: "2026-11-20T10:00:00.000Z", updatedAt: "2026-11-20T10:00:00.000Z",
  releaseContext: { window: null, scope: { applicationCount: 1, repositoryCount: 1, targetEnvironment: "production" }, approval: { prStatus: "pending", noPrRequired: false },
    readiness: { developmentReady: true, productionReady: false, validationStepCount: 1, deferredValidation: false, approvalDecision: "needs_attention", blockers: [] },
    recovery: { rollbackAvailability: "yes", backupRequired: false, evidenceCount: 0 }, observation: { status: "not_connected", recordedMonitoringPlan: false } } } as never;

it("exports the exact version with a non-approval note", () => {
  const json = JSON.parse(releaseRecordJson(request));
  expect(json).toMatchObject({ kind: "v19.release-record", id: "rel_1", version: 3, status: "submitted" });
  expect(json.note).toContain("not an approval");
});

it("copies to the clipboard and reports the outcome", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(createElement(CopyReleaseRecord, { request }));
  fireEvent.click(screen.getByRole("button", { name: "Copy release record (JSON)" }));
  expect(await screen.findByText("Copied this exact version.")).toBeTruthy();
  expect(JSON.parse(writeText.mock.calls[0][0]).id).toBe("rel_1");
});
