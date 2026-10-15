import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ verify: vi.fn(), set: vi.fn(), read: vi.fn(), write: vi.fn(), clear: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { verifyCredentialCandidate: mock.verify, setSession: mock.set } }));
vi.mock("../../../desktop/src/lib/secureStorage", () => ({ readSecret: mock.read, writeSecret: mock.write, clearSecret: mock.clear }));
import { hydrateDesktopCredential, signOutDesktopCredentials, verifyAndActivateApiKey, verifyAndActivatePairedSession } from "../../../desktop/src/lib/activeDesktopCredential";
const selectionKey = "desktop.credential.selection.v1";
const oldKey = `vxlk_test_${"A".repeat(24)}_${"B".repeat(6)}`;
const newKey = `vxlk_test_${"C".repeat(24)}_${"D".repeat(6)}`;
const token = "axm.desk.new_session.signature";
const session = { id: "new_session", deviceLabel: "Mac", expiresAt: "2099-01-01T00:00:00Z" };
const identity = { organizationId: "verified" };
let vault: Map<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks(); vault = new Map();
  mock.verify.mockResolvedValue({ ok: true, data: identity });
  mock.read.mockImplementation(async (key: string) => structuredClone(vault.get(key)));
  mock.write.mockImplementation(async (key: string, value: unknown) => { vault.set(key, structuredClone(value)); });
  mock.clear.mockImplementation(async (key: string) => { vault.delete(key); });
});
afterEach(() => { vi.restoreAllMocks(); });
describe("verified desktop credential selection survives restart", () => {
  it("restores recovered browser identity instead of an older saved API key", async () => {
    vault.set("desktop.api_key", oldKey);
    await verifyAndActivatePairedSession(token, session);
    expect(vault.get("desktop.api_key")).toBe(oldKey);
    mock.set.mockClear();
    await hydrateDesktopCredential(); // bootstrap of a new process reads only durable values
    expect(mock.set.mock.calls).toEqual([[undefined], [token]]);
    expect(mock.verify).toHaveBeenCalledExactlyOnceWith(token);
  });
  it("preserves the inactive paired credential when administrator recovery becomes selected", async () => {
    await verifyAndActivatePairedSession(token, session);
    await verifyAndActivateApiKey(newKey);
    expect(vault.get(selectionKey)).toEqual({ version: 1, active: "api_key", apiKey: newKey, pairedSession: { token, session } });
    mock.set.mockClear(); await hydrateDesktopCredential();
    expect(mock.set.mock.calls).toEqual([[undefined], [newKey]]);
  });
  it("does not replace the selected identity until the candidate verifies", async () => {
    await verifyAndActivateApiKey(oldKey);
    const before = structuredClone(vault.get(selectionKey));
    mock.verify.mockResolvedValue({ ok: false, error: "candidate revoked" });
    mock.set.mockClear();
    await expect(verifyAndActivatePairedSession(token, session)).rejects.toThrow("candidate revoked");
    expect(vault.get(selectionKey)).toEqual(before); expect(mock.set).not.toHaveBeenCalled();
    await hydrateDesktopCredential(); expect(mock.set).toHaveBeenLastCalledWith(oldKey);
  });
  it("keeps the previous selection when the single vault commit fails", async () => {
    await verifyAndActivateApiKey(oldKey);
    mock.write.mockRejectedValue(new Error("vault denied")); mock.set.mockClear();
    await expect(verifyAndActivatePairedSession(token, session)).rejects.toThrow("vault denied");
    expect(mock.set).not.toHaveBeenCalled();
    await hydrateDesktopCredential(); expect(mock.set).toHaveBeenLastCalledWith(oldKey);
  });
  it("cancels before commit when verification finishes after cancellation", async () => {
    const controller = new AbortController();
    mock.verify.mockImplementation(async () => { controller.abort(); return { ok: true, data: identity }; });
    const committing = vi.fn();
    await expect(verifyAndActivatePairedSession(token, session, controller.signal, committing)).rejects.toMatchObject({ name: "AbortError" });
    expect(mock.write).not.toHaveBeenCalled(); expect(mock.set).not.toHaveBeenCalled(); expect(committing).not.toHaveBeenCalled();
  });
  it("does not persist administrator recovery verified after its view cancels", async () => {
    const controller = new AbortController();
    mock.verify.mockImplementation(async () => { controller.abort(); return { ok: true, data: identity }; });
    await expect(verifyAndActivateApiKey(newKey, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(mock.write).not.toHaveBeenCalled(); expect(mock.set).not.toHaveBeenCalled();
  });
  it("checks cancellation again after reading selection but before the commit boundary", async () => {
    const controller = new AbortController();
    mock.read.mockImplementation(async () => { controller.abort(); return undefined; });
    const committing = vi.fn();
    await expect(verifyAndActivatePairedSession(token, session, controller.signal, committing)).rejects.toMatchObject({ name: "AbortError" });
    expect(mock.write).not.toHaveBeenCalled(); expect(committing).not.toHaveBeenCalled();
  });
  it("enters saving only after verification and before the one durable write", async () => {
    const order: string[] = [];
    mock.verify.mockImplementation(async () => { order.push("verified"); return { ok: true, data: identity }; });
    mock.write.mockImplementation(async (key: string, value: unknown) => { order.push("write"); vault.set(key, value); });
    await verifyAndActivatePairedSession(token, session, undefined, () => order.push("saving"));
    expect(order).toEqual(["verified", "saving", "write"]);
    expect(mock.write).toHaveBeenCalledTimes(1);
  });
  it.each([
    { version: 1, active: "paired_session" },
    { version: 1, active: "api_key" },
    { version: 9, active: "api_key", apiKey: newKey },
    { version: 1, active: "paired_session", pairedSession: { token, session: { ...session, expiresAt: "2000-01-01" } } },
  ])("fails closed on an unusable explicit selection without restoring an older identity: %j", async selection => {
    vault.set("desktop.api_key", oldKey); vault.set(selectionKey, selection);
    await expect(hydrateDesktopCredential()).rejects.toThrow();
    expect(mock.set.mock.calls).toEqual([[undefined]]);
    expect(mock.clear).not.toHaveBeenCalled();
  });
  it("retains API-key-first compatibility when no explicit selection exists", async () => {
    vault.set("desktop.api_key", oldKey); vault.set("desktop.session.token", token); vault.set("desktop.session.meta", session);
    await hydrateDesktopCredential(); expect(mock.set.mock.calls).toEqual([[undefined], [oldKey]]);
    expect(mock.write).not.toHaveBeenCalled(); expect(mock.clear).not.toHaveBeenCalled();
  });
  it("hydrates a legacy pairing when no API key or selector exists", async () => {
    vault.set("desktop.session.token", token); vault.set("desktop.session.meta", session);
    await hydrateDesktopCredential(); expect(mock.set).toHaveBeenLastCalledWith(token);
  });
  it("persists sign-out before cleanup, preventing legacy fallback when cleanup fails", async () => {
    vault.set("desktop.api_key", oldKey); await verifyAndActivatePairedSession(token, session);
    mock.clear.mockRejectedValue(new Error("cleanup denied"));
    await expect(signOutDesktopCredentials()).rejects.toThrow("older saved credentials");
    mock.set.mockClear(); await hydrateDesktopCredential();
    expect(mock.set.mock.calls).toEqual([[undefined]]); expect(vault.get("desktop.api_key")).toBe(oldKey);
  });
  it("locks the active transport even when saving sign-out fails", async () => {
    mock.write.mockRejectedValue(new Error("vault unavailable"));
    await expect(signOutDesktopCredentials()).rejects.toThrow("vault unavailable");
    expect(mock.set).toHaveBeenCalledExactlyOnceWith(undefined); expect(mock.clear).not.toHaveBeenCalled();
  });
});
