import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({ Resend: class { emails = { send: m.send }; } }));
import { sendGoogleLinkConfirmation } from "../emailVerification";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("missing mail configuration is explicit and does not invoke transport or log plaintext proof", async () => {
  vi.stubEnv("RESEND_API_KEY", ""); const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try { expect(await sendGoogleLinkConfirmation({ to: "synthetic@example.test", code: "PRIVATE_MAIL_CODE" })).toBe(false); expect(m.send).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); }
  finally { log.mockRestore(); }
});
it("passes copyable proof only to existing transport, without a state-mutating email link", async () => {
  vi.stubEnv("RESEND_API_KEY", "re_synthetic_not_a_live_key"); m.send.mockResolvedValue({ error: null });
  expect(await sendGoogleLinkConfirmation({ to: "synthetic@example.test", code: "synthetic-proof" })).toBe(true);
  expect(m.send.mock.calls[0][0].text).toContain("synthetic-proof"); expect(m.send.mock.calls[0][0].text).not.toMatch(/https?:\/\//);
});
