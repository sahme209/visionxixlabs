import { describe, expect, it, vi } from "vitest";
import { createCredentialVerificationCoordinator } from "../../../desktop/src/lib/credentialVerificationCoordinator";

type Result = { ok: true; data: string } | { ok: false; error: string };
function deferred() {
  let resolve!: (result: Result) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Result>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  let context = { version: {}, present: true };
  const first = deferred();
  const second = deferred();
  const options = {
    readContext: () => context,
    verify: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
    onVerified: vi.fn(), onRejected: vi.fn(), onMissing: vi.fn(),
  };
  const coordinator = createCredentialVerificationCoordinator<string>(options);
  return { coordinator, options, first, second, changeContext(present = true) { context = { version: {}, present }; } };
}

describe("desktop saved-credential verification lifecycle", () => {
  it("ignores an older rejection after the latest request succeeds", async () => {
    const h = harness();
    const a = h.coordinator.verify(), b = h.coordinator.verify();
    h.second.resolve({ ok: true, data: "current-workspace" }); await b;
    h.first.resolve({ ok: false, error: "old failure" }); await a;
    expect(h.options.onVerified).toHaveBeenCalledExactlyOnceWith("current-workspace");
    expect(h.options.onRejected).not.toHaveBeenCalled();
  });
  it("ignores an older success after the latest request rejects access", async () => {
    const h = harness();
    const a = h.coordinator.verify(), b = h.coordinator.verify();
    h.second.resolve({ ok: false, error: "revoked" }); await b;
    h.first.resolve({ ok: true, data: "stale-workspace" }); await a;
    expect(h.options.onVerified).not.toHaveBeenCalled();
    expect(h.options.onRejected).toHaveBeenCalledExactlyOnceWith("revoked");
  });
  it.each([true, false])("ignores a response after credential context changes (present=%s)", async (present) => {
    const h = harness(); const request = h.coordinator.verify();
    h.changeContext(present);
    h.first.resolve({ ok: false, error: "old credential" }); await request;
    expect(h.options.onRejected).not.toHaveBeenCalled();
    expect(h.options.onVerified).not.toHaveBeenCalled();
  });
  it("ignores pending work after an explicit sign-in or sign-out transition", async () => {
    const h = harness(); const request = h.coordinator.verify();
    h.coordinator.invalidate();
    h.first.resolve({ ok: true, data: "previous-workspace" }); await request;
    expect(h.options.onVerified).not.toHaveBeenCalled();
  });
  it("does not apply or start verification after unmount", async () => {
    const h = harness(); const request = h.coordinator.verify();
    h.coordinator.dispose();
    h.first.resolve({ ok: true, data: "unmounted-workspace" }); await request;
    await h.coordinator.verify();
    expect(h.options.verify).toHaveBeenCalledTimes(1);
    expect(h.options.onVerified).not.toHaveBeenCalled();
  });
  it("reports a missing credential without making a request", async () => {
    const h = harness(); h.changeContext(false); await h.coordinator.verify();
    expect(h.options.onMissing).toHaveBeenCalledOnce();
    expect(h.options.verify).not.toHaveBeenCalled();
  });
  it("fails closed on unexpected transport errors without exposing their payload", async () => {
    const h = harness(); const request = h.coordinator.verify();
    h.first.reject(new Error("private provider details")); await request;
    expect(h.options.onVerified).not.toHaveBeenCalled();
    expect(h.options.onRejected).toHaveBeenCalledExactlyOnceWith("The workspace service could not be reached. Try signing in again.");
  });
});
