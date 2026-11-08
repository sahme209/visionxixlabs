/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ vault: new Map<string, unknown>(), browser: vi.fn(), read: vi.fn(), write: vi.fn(), clear: vi.fn() }));
vi.mock("../../../desktop/src/lib/secureStorage", () => ({ readSecret: m.read, writeSecret: m.write, clearSecret: m.clear }));
vi.mock("../../../desktop/src/lib/desktopPairing", () => ({ signInWithBrowser: m.browser }));
vi.mock("../../../desktop/src/lib/preferences", () => ({ readDesktopPreferences: async () => ({}) }));
vi.mock("../../../desktop/src/lib/useNativeMenuActions", () => ({ useNativeMenuActions: () => {} }));
vi.mock("../../../desktop/src/components/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("../../../desktop/src/components/TopBar", () => ({ TopBar: () => null }));
vi.mock("../../../desktop/src/views/AgentChatView", () => ({ AgentChatView: () => createElement("p", null, "Verified operational workspace") }));
vi.mock("../../../desktop/src/views/DeploymentRequestsView", () => ({ DeploymentRequestsView: () => null }));
vi.mock("../../../desktop/src/views/DocsView", () => ({ DocsView: () => null }));
vi.mock("../../../desktop/src/views/SettingsView", () => ({ SettingsView: () => null }));
vi.mock("../../../desktop/src/views/PluginsSkillsView", () => ({ PluginsSkillsView: () => null }));
vi.mock("../../../desktop/src/views/RepositoryWorkspaceView", () => ({ RepositoryWorkspaceView: () => null }));
vi.mock("../../../desktop/src/views/AirflowAutomationView", () => ({ AirflowAutomationView: () => null }));
import App from "../../../desktop/src/App";
import { desktopClient } from "../../../desktop/src/lib/desktopClient";
const key = `vxlk_test_${"A".repeat(24)}_${"B".repeat(6)}`;
const selection = "desktop.credential.selection.v1";
const identity = { kind: "api_key", organizationId: "workspace-current", capabilities: [], access: { allowed: true, code: "active", title: "Active", message: "Active", planTier: "team", billingStatus: "active", accessRequestPath: "/access", pricingPath: "/pricing" } };
const success = (kind: "api_key" | "desktop_session" = "api_key") => new Response(JSON.stringify({ ok: true, data: { identity: { ...identity, kind }, access: identity.access } }), { status: 200 });
// The server reports the kind of the credential it verified; App re-verifies each newly active context.
const currentSuccess = () => success(desktopClient.config.sessionToken?.startsWith("axm.desk.") ? "desktop_session" : "api_key");
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); m.vault.clear();
  m.read.mockImplementation(async (key: string) => structuredClone(m.vault.get(key)));
  m.write.mockImplementation(async (key: string, value: unknown) => { m.vault.set(key, structuredClone(value)); });
  m.clear.mockImplementation(async (key: string) => { m.vault.delete(key); });
  m.vault.set(selection, { version: 1, active: "api_key", apiKey: key });
  desktopClient.setSession(key);
  fetchMock = vi.fn().mockRejectedValueOnce(new Error("private transport payload")).mockImplementation(async () => currentSuccess());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function locked() {
  render(createElement(App));
  await screen.findByRole("button", { name: "Log in" });
  expect(desktopClient.hasAuth()).toBe(false);
  expect(screen.queryByText("Verified operational workspace")).toBeNull();
}
it("recovers a transient saved sign-in failure through the mounted App without writing the vault", async () => {
  await locked();
  fireEvent.focus(window);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  expect(screen.queryByText(/private transport payload/)).toBeNull();
  await screen.findByRole("heading", {name: "What are we working on?"});
  fireEvent.click(screen.getByRole("button", {name: /Build with AI/}));
  await screen.findByText("Verified operational workspace");
  expect(desktopClient.config.sessionToken).toBe(key);
  // Saved-candidate verification, then App re-verifies the newly active context.
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(m.write).not.toHaveBeenCalled(); expect(m.clear).not.toHaveBeenCalled();
});
it.each([401, 403, 200])("keeps rejected or invalid initial verification locked (HTTP %s)", async status => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "private rejected payload" }), { status }));
  await locked();
  expect(screen.queryByRole("button", { name: "Retry saved sign-in" })).toBeNull();
  expect(screen.queryByText(/private rejected payload/)).toBeNull();
  expect(m.clear).not.toHaveBeenCalled();
});
it("does not activate a saved retry whose vault selection changes during verification", async () => {
  const pending = deferred<Response>();
  await locked(); fetchMock.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  m.vault.set(selection, { version: 1, active: "signed_out" });
  await act(async () => { pending.resolve(success()); });
  expect(desktopClient.hasAuth()).toBe(false);
  expect(screen.queryByText("Verified operational workspace")).toBeNull();
});
it.each(["success", "failure"])("ignores a canceled saved retry %s after the customer chooses browser sign-in", async outcome => {
  const pending = deferred<Response>();
  await locked(); fetchMock.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  m.browser.mockImplementation(async () => { desktopClient.setSession("axm.desk.new.signature"); return { ...identity, kind: "desktop_session", organizationId: "browser-workspace" }; });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
  await act(async () => { pending.resolve(outcome === "success" ? success() : new Response(JSON.stringify({ error: "private late error" }), { status: 401 })); });
  expect(desktopClient.config.sessionToken).toBe("axm.desk.new.signature");
  expect(m.browser).toHaveBeenCalledOnce();
});
it("stays locked and stops offering retry after definitive rejection on an explicit retry", async () => {
  await locked();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "private denial" }), { status: 401 }));
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Retry saved sign-in" })).toBeNull());
  expect(desktopClient.hasAuth()).toBe(false);
  expect(m.write).not.toHaveBeenCalled(); expect(m.clear).not.toHaveBeenCalled();
  expect(screen.queryByText(/private denial/)).toBeNull();
});
it("does not activate a pending saved retry after unmount", async () => {
  const pending = deferred<Response>();
  const view = render(createElement(App));
  await screen.findByRole("button", { name: "Retry saved sign-in" });
  fetchMock.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  view.unmount();
  await act(async () => { pending.resolve(success()); });
  expect(desktopClient.hasAuth()).toBe(false);
});
it("does not activate a pending saved retry after the service context changes", async () => {
  const pending = deferred<Response>();
  await locked(); fetchMock.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  desktopClient.setSession("axm.desk.newcontext.signature");
  await act(async () => { pending.resolve(success()); });
  expect(desktopClient.config.sessionToken).toBe("axm.desk.newcontext.signature");
  expect(screen.queryByText("Verified operational workspace")).toBeNull();
});
it("rejects a changed durable selection snapshot even when its selected token is unchanged", async () => {
  const pending = deferred<Response>();
  await locked(); fetchMock.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  m.vault.set(selection, { version: 1, active: "api_key", apiKey: key, pairedSession: { token: "different-selection" } });
  await act(async () => { pending.resolve(success()); });
  expect(desktopClient.hasAuth()).toBe(false);
  expect(screen.queryByText("Verified operational workspace")).toBeNull();
});
it("cannot verify or activate a late vault read after the retry is canceled", async () => {
  const pending = deferred<unknown>();
  await locked(); m.read.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => { pending.resolve(m.vault.get(selection)); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(desktopClient.hasAuth()).toBe(false);
  expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
});
it("keeps verified identity separate from entitlement and does not offer saved recovery after explicit sign-out", async () => {
  await locked();
  const access = { ...identity.access, allowed: false, code: "production_access_required" };
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true, data: { identity, access } }), { status: 200 }));
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await screen.findByRole("button", { name: "Request pilot access" });
  expect(screen.queryByText("Verified operational workspace")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use another account" }));
  await screen.findByRole("button", { name: "Log in" });
  expect(screen.queryByRole("button", { name: "Retry saved sign-in" })).toBeNull();
  expect(m.vault.get(selection)).toEqual({ version: 1, active: "signed_out" });
});
it.each([
  { version: 1, active: "signed_out" },
  { version: 1, active: "api_key" },
  { version: 99, active: "api_key", apiKey: key },
  { version: 1, active: "paired_session", pairedSession: { token: "axm.desk.expired.signature", session: { id: "expired", deviceLabel: "Desktop", expiresAt: "2000-01-01T00:00:00Z" } } },
])("never restores an inactive legacy key for an unavailable selected credential (%j)", async saved => {
  await locked();
  m.vault.set("desktop.api_key", key);
  m.vault.set(selection, saved);
  fireEvent.click(screen.getByRole("button", { name: "Retry saved sign-in" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Retry saved sign-in" })).toBeNull());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(desktopClient.hasAuth()).toBe(false);
  expect(m.write).not.toHaveBeenCalled(); expect(m.clear).not.toHaveBeenCalled();
});

it.each([401, 403, 200, 503])("shows one actionable recovery message without redundant saved-sign-in warnings (HTTP %s)", async status => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "private failure payload" }), { status }));
  await locked();
  const alerts = screen.getAllByRole("alert");
  expect(alerts).toHaveLength(1);
  expect(alerts[0].textContent).not.toMatch(/could not be verified.*could not be verified/);
  expect(alerts[0].textContent).not.toMatch(/Your saved sign-in could not be verified/);
  expect(screen.queryByRole("button", { name: "Retry saved sign-in" }) !== null).toBe(status === 503);
  expect(screen.queryByText(/private failure payload/)).toBeNull();
  expect(m.write).not.toHaveBeenCalled(); expect(m.clear).not.toHaveBeenCalled();
});
