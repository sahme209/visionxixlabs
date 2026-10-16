import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn(), read: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: mocks.open }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue({ platform: "macos", arch: "arm64" }) }));
vi.mock("../../../desktop/src/lib/activeDesktopCredential", () => ({ verifyAndActivatePairedSession: mocks.save }));
vi.mock("../../../desktop/src/lib/secureStorage", () => ({ readSecret: mocks.read, writeSecret: vi.fn() }));
import { desktopClient } from "../../../desktop/src/lib/desktopClient";
import { signInWithBrowser } from "../../../desktop/src/lib/desktopPairing";
const session = { id: "session", deviceLabel: "Mac", expiresAt: "2099-01-01T00:00:00Z" };
function response(body: unknown, status = 200) { return { ok: status < 400, status, json: vi.fn().mockResolvedValue(body) }; }
beforeEach(() => {
  desktopClient.setApiBase("https://visionxixlabs.com");
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
      controller.abort(); return { challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in" };
    } }));
    await expect(signInWithBrowser("sign_in", vi.fn(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not persist approval received after cancellation during response decoding", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in" }))
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in" }))
      .mockResolvedValueOnce(response({ status: "approved", token: "axm.desk.session.signature", session })));
    const waiting = vi.fn(); const attempt = signInWithBrowser("sign_in", waiting);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(attempt).resolves.toEqual({ organizationId: "verified" }); expect(waiting).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("axm.desk.session.signature", session, undefined, undefined);
  });
});


describe("trusted browser pairing origin and challenge boundary", () => {
  it.each([
    "https://evil.invalid/desktop/connect?challenge=challenge&intent=sign_in",
    "https://visionxixlabs.com.evil.invalid/desktop/connect?challenge=challenge&intent=sign_in",
    "https://user:password@visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in",
    "http://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in",
    "javascript:alert(1)", "file:///desktop/connect", "/desktop/connect?challenge=challenge&intent=sign_in",
    "https://visionxixlabs.com/auth/signin?challenge=challenge&intent=sign_in",
    "https://visionxixlabs.com/desktop/connect?challenge=other&intent=sign_in",
    "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_up",
    "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in&intent=sign_in",
    "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in&callbackUrl=https://evil.invalid",
    "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in#unexpected",
  ])("refuses malicious or mismatched response before opening OS browser: %s", async verificationUrl => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl }));
    vi.stubGlobal("fetch", fetch); const waiting = vi.fn();
    await expect(signInWithBrowser("sign_in", waiting)).rejects.toThrow("sign-in link");
    expect(mocks.open).not.toHaveBeenCalled(); expect(waiting).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledOnce();
  });
  it("preserves configured loopback development origin and sign-up intent without cookie or redirect following", async () => {
    desktopClient.setApiBase("http://127.0.0.1:4100/");
    const verificationUrl = "http://127.0.0.1:4100/desktop/connect?challenge=challenge&intent=sign_up";
    const fetch = vi.fn().mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl })).mockResolvedValueOnce(response({ status: "approved", token: "axm.desk.session.signature", session }));
    vi.stubGlobal("fetch", fetch);
    const attempt = signInWithBrowser("sign_up", vi.fn()); await vi.advanceTimersByTimeAsync(2000); await expect(attempt).resolves.toEqual({ organizationId: "verified" });
    expect(mocks.open).toHaveBeenCalledWith(verificationUrl);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(["http://127.0.0.1:4100/api/desktop/pair/start", "http://127.0.0.1:4100/api/desktop/pair/status"]);
    for (const call of fetch.mock.calls) expect(call[1]).toMatchObject({ credentials: "omit", redirect: "error" });
  });
  it("refuses configured-origin changes before browser open and can safely retry", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => {
      desktopClient.setApiBase("https://other.invalid"); return { challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in" };
    } });
    vi.stubGlobal("fetch", fetch);
    await expect(signInWithBrowser("sign_in", vi.fn())).rejects.toThrow("service changed"); expect(mocks.open).not.toHaveBeenCalled();
    desktopClient.setApiBase("https://visionxixlabs.com");
    fetch.mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in" })).mockResolvedValueOnce(response({ status: "approved", token: "axm.desk.session.signature", session }));
    const retry = signInWithBrowser("sign_in", vi.fn()); await vi.advanceTimersByTimeAsync(2000); await expect(retry).resolves.toEqual({ organizationId: "verified" });
  });
  it("does not persist an approval verified against a changed service origin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ challenge: "challenge", verificationUrl: "https://visionxixlabs.com/desktop/connect?challenge=challenge&intent=sign_in" })).mockResolvedValueOnce({ ok: true, status: 200, json: async () => {
      desktopClient.setApiBase("https://other.invalid"); return { status: "approved", token: "axm.desk.session.signature", session };
    } }));
    const outcome = expect(signInWithBrowser("sign_in", vi.fn())).rejects.toThrow("service changed"); await vi.advanceTimersByTimeAsync(2000); await outcome; expect(mocks.save).not.toHaveBeenCalled();
  });
});
