/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReleaseWorkflowButton } from "../ReleaseWorkflowButton";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function dispatch(body: object, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status < 400, json: async () => body }));
  render(createElement(ReleaseWorkflowButton, { releaseId: "release-1" }));
  fireEvent.click(screen.getByRole("button", { name: "Dispatch workflow" }));
  return screen.findByRole("status");
}
it("labels a known requested restart without claiming an artifact or healthy deployment", async () => {
  const status = await dispatch({ ok: true, data: { evidence: { requestedOperation: "service_restart" } } });
  expect(status.textContent).toContain("Workflow dispatch accepted.");
  expect(status.textContent).toContain("Requested operation: ECS service restart.");
  expect(status.textContent).toContain("source artifact release, application health and image rollback remain unverified");
  expect(fetch).toHaveBeenCalledWith("/api/dashboard/release-deploy", expect.objectContaining({ body: JSON.stringify({ releaseId: "release-1" }) }));
});
it("does not classify a custom or old receipt as a restart", async () => {
  const status = await dispatch({ ok: true, data: { status: "deploying" } });
  expect(status.textContent).toContain("Requested operation unverified.");
  expect(status.textContent).not.toContain("Requested operation: ECS service restart");
});
it("keeps already-dispatched lifecycle failure distinct from a retryable rejection", async () => {
  const status = await dispatch({ ok: false, error: "dispatched_but_lifecycle_transition_failed", evidence: { requestedOperation: "service_restart" } }, 207);
  expect(status.textContent).toContain("Workflow dispatched; release record update unconfirmed.");
  expect(screen.queryByRole("button")).toBeNull();
});
it("does not offer automatic retry after a lost dispatch response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  render(createElement(ReleaseWorkflowButton, { releaseId: "release-1" }));
  fireEvent.click(screen.getByRole("button", { name: "Dispatch workflow" }));
  expect((await screen.findByRole("status")).textContent).toContain("outcome unconfirmed");
  expect(screen.queryByRole("button")).toBeNull();
});
it("prevents duplicate dispatch while provider acceptance is pending", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(createElement(ReleaseWorkflowButton, { releaseId: "release-1" }));
  const button = screen.getByRole("button", { name: "Dispatch workflow" });
  fireEvent.click(button); fireEvent.click(button); expect(fetch).toHaveBeenCalledOnce();
});
it("keeps a definite role rejection distinct from provider acceptance", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: "forbidden_role" }) }));
  render(createElement(ReleaseWorkflowButton, { releaseId: "release-1" }));
  fireEvent.click(screen.getByRole("button", { name: "Dispatch workflow" }));
  expect((await screen.findByRole("alert")).textContent).toBe("forbidden_role");
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Dispatch workflow" }).hasAttribute("disabled")).toBe(false);
});

it("treats an opaque provider dispatch failure as unconfirmed rather than proof of rejection", async () => {
  const status = await dispatch({ ok: false, error: "dispatch_failed", hint: "provider response unavailable" }, 502);
  expect(status.textContent).toContain("outcome unconfirmed");
  expect(screen.queryByRole("button")).toBeNull();
});
