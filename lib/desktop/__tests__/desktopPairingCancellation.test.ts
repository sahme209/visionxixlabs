import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn(), read: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: mocks.open }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue({ platform: "macos", arch: "arm64" }) }));
vi.mock("../../../desktop/src/lib/activeDesktopCredential", () => ({ verifyAndActivatePairedSession: mocks.save }));
vi.mock("../../../desktop/src/lib/secureStorage", () => ({ readSecret: mocks.read, writeSecret: vi.fn() }));
import { signInWithBrowser } from "../../../desktop/src/lib/desktopPairing";
const session = { id: "session", deviceLabel: "Mac", expiresAt: "2099-01-01T00:00:00Z" };
function response(body: unknown, status = 200) { return { ok: status < 400, status, json: vi.fn().mockResolvedValue(body) }; }
beforeEach(() => {
  mocks.save.mockResolvedValue({ organizationId: "verified" });
  vi.useFakeTimers(); mocks.read.mockResolvedValue("fingerprint"); mocks.open.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { platform: "MacIntel" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
describe("browser pairing cancellation boundaries", () => {
  it("does not start any request for an already cancelled attempt", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const controller = new AbortController(); controller.abort();
    await expect(signInWithBrowser("sign_in", vi.fn(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.open).not.toHaveBeenCalled();
  });
  it("does not open the browser after cancellation during start-response decoding", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => {
      controller.abort(); return { challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/pair" };
    } }));
    await expect(signInWithBrowser("sign_in", vi.fn(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not persist approval received after cancellation during response decoding", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/pair" }))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => {
        controller.abort(); return { status: "approved", token: "axm.desk.session.signature", session };
      } });
    vi.stubGlobal("fetch", fetch);
    const attempt = signInWithBrowser("sign_in", vi.fn(), controller.signal);
    const outcome = expect(attempt).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(2000); await outcome;
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("still saves a non-cancelled approval exactly once", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/pair" }))
      .mockResolvedValueOnce(response({ status: "approved", token: "axm.desk.session.signature", session })));
    const waiting = vi.fn(); const attempt = signInWithBrowser("sign_in", waiting);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(attempt).resolves.toEqual({ organizationId: "verified" }); expect(waiting).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("axm.desk.session.signature", session, undefined, undefined);
  });
});
