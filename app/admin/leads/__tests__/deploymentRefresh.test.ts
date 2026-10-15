/** @vitest-environment jsdom */
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/components/motion/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/motion/Stagger", () => ({ Stagger: ({ children }: { children: ReactNode }) => children }));
import AdminLeadsPage from "../page";
const fetchMock = vi.fn();
const lead = { id: "lead_fixture", email: "customer@example.test", name: "Customer", status: "deploy_ready", createdAt: "2026-10-15T12:00:00Z", fullPayload: { aiPackage: {}, previewUrl: "https://working.vercel.app", previewDeployment: { deploymentId: "dpl_pending", state: "BUILDING" } } };
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("observes pending deployment through admin GET and reloads served state without dispatching", async () => {
  let resolveRefresh!: (response: unknown) => void;
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/leads/status")) return new Promise((resolve) => { resolveRefresh = resolve; });
    return Promise.resolve({ ok: true, json: async () => ({ leads: [lead] }) });
  });
  render(createElement(AdminLeadsPage));
  const refresh = await screen.findByRole("button", { name: "Refresh deployment" });
  expect(screen.getByRole("link", { name: "Current preview: https://working.vercel.app" }).getAttribute("href")).toBe("https://working.vercel.app");
  expect(screen.getByRole("status").textContent).toContain("Deployment pending");
  expect((screen.getByRole("button", { name: "Regenerate preview" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(refresh);
  expect((screen.getByRole("button", { name: "Refreshing deployment..." }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith("/api/leads/status?leadId=lead_fixture", { cache: "no-store" });
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true, json: async () => ({ leads: [{ ...lead, fullPayload: { ...lead.fullPayload, previewUrl: "https://new.vercel.app", previewDeployment: { deploymentId: "dpl_pending", state: "READY" } } }] }) }));
  resolveRefresh({ ok: true, json: async () => ({ deploymentPending: false }) });
  await screen.findByRole("link", { name: "Current preview: https://new.vercel.app" });
  expect(screen.queryByRole("button", { name: "Refresh deployment" })).toBeNull();
  expect((screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled).toBe(false);
  expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});
it("shows a failed refresh inline, preserves current preview and permits observation retry", async () => {
  fetchMock.mockImplementation((url: string) => url.startsWith("/api/leads/status")
    ? Promise.resolve({ ok: false, json: async () => ({ error: "Provider observation unavailable" }) })
    : Promise.resolve({ ok: true, json: async () => ({ leads: [lead] }) }));
  render(createElement(AdminLeadsPage));
  fireEvent.click(await screen.findByRole("button", { name: "Refresh deployment" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Provider observation unavailable");
  await waitFor(() => expect((screen.getByRole("button", { name: "Refresh deployment" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole("link", { name: "Current preview: https://working.vercel.app" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled).toBe(true);
});
it("permits explicit retry for managed-pending because no provider request was sent", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ leads: [{ ...lead, status: "package_ready", fullPayload: { aiPackage: {}, previewDeployment: { deploymentId: "managed-pending", state: "PENDING" } } }] }) });
  render(createElement(AdminLeadsPage));
  expect((await screen.findByRole("status")).textContent).toContain("No provider request was sent");
  expect(screen.queryByRole("button", { name: "Refresh deployment" })).toBeNull();
  expect((screen.getByRole("button", { name: "Regenerate preview" }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled).toBe(false);
});
it("shows terminal failure after refresh while keeping the old working preview", async () => {
  let finished = false;
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/leads/status")) { finished = true; return Promise.resolve({ ok: true, json: async () => ({ deploymentPending: false }) }); }
    return Promise.resolve({ ok: true, json: async () => ({ leads: [{ ...lead, fullPayload: { ...lead.fullPayload, previewDeployment: { deploymentId: "dpl_pending", state: finished ? "ERROR" : "BUILDING" } } }] }) });
  });
  render(createElement(AdminLeadsPage));
  fireEvent.click(await screen.findByRole("button", { name: "Refresh deployment" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Latest deployment failed");
  expect(screen.getByRole("link", { name: "Current preview: https://working.vercel.app" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled).toBe(false);
});
