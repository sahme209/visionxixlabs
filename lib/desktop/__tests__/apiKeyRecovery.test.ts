import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), setSession: vi.fn(), write: vi.fn(), clear: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { verifyCredentialCandidate: mocks.verify, setSession: mocks.setSession } }));
vi.mock("../../../desktop/src/lib/secureStorage", () => ({ readSecret: vi.fn(), writeSecret: mocks.write, clearSecret: mocks.clear }));
import { verifyAndSaveApiKey } from "../../../desktop/src/lib/apiKeyStore";
const key = `vxlk_test_${"A".repeat(24)}_${"B".repeat(6)}`;
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });
describe("desktop administrator recovery preserves existing credentials", () => {
  it("rejects malformed input without touching vault or active transport", async () => {
    await expect(verifyAndSaveApiKey("invalid")).rejects.toThrow("format invalid");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it("keeps saved credentials when the server rejects the candidate", async () => {
    mocks.verify.mockResolvedValue({ ok: false, error: "revoked" });
    await expect(verifyAndSaveApiKey(key)).rejects.toThrow("revoked");
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it("does not activate a candidate when secure persistence fails", async () => {
    mocks.verify.mockResolvedValue({ ok: true, data: { organizationId: "org-verified" } });
    mocks.write.mockRejectedValue(new Error("vault unavailable"));
    await expect(verifyAndSaveApiKey(key)).rejects.toThrow("vault unavailable");
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
  it("persists and activates only after successful verification", async () => {
    const identity = { organizationId: "org-verified" };
    mocks.verify.mockResolvedValue({ ok: true, data: identity });
    mocks.write.mockImplementation(async () => { expect(mocks.verify).toHaveBeenCalledExactlyOnceWith(key); expect(mocks.setSession).not.toHaveBeenCalled(); });
    expect(await verifyAndSaveApiKey(` ${key} `)).toEqual(identity);
    expect(mocks.write).toHaveBeenCalledExactlyOnceWith("desktop.api_key", key);
    expect(mocks.setSession).toHaveBeenCalledExactlyOnceWith(key);
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
