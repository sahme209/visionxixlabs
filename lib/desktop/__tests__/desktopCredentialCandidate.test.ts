import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";
afterEach(() => vi.unstubAllGlobals());
describe("non-mutating recovery credential verification", () => {
  it("sends only the candidate bearer and preserves the active configuration", async () => {
    const client = new DesktopClient({ apiBase: "https://service.example.test", sessionToken: "axm.desk.previous" });
    const config = client.config;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "revoked" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await client.verifyCredentialCandidate("vxlk_candidate")).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledWith("https://service.example.test/api/desktop/access", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer vxlk_candidate" }) }));
    expect(client.config).toBe(config);
    expect(client.config.sessionToken).toBe("axm.desk.previous");
  });
  it("does not send the existing credential when the candidate is missing or unsupported", async () => {
    const client = new DesktopClient({ sessionToken: "axm.desk.previous" });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await client.verifyCredentialCandidate(undefined)).toMatchObject({ ok: false });
    expect(await client.verifyCredentialCandidate("unsupported")).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.config.sessionToken).toBe("axm.desk.previous");
  });
});
it.each([[401, "rejected"], [403, "rejected"], [500, "unavailable"], [429, "unavailable"], [404, "invalid"], [200, "invalid"]])("classifies access HTTP %s without leaking response errors", async (status, failureKind) => {
  const client = new DesktopClient();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "private details" }), { status: status as number })));
  const result = await client.verifyCredentialCandidate("vxlk_candidate");
  expect(result).toMatchObject({ ok: false, failureKind });
  expect(JSON.stringify(result)).not.toContain("private details");
});
it("classifies an aborted verification as cancellation rather than unavailable", async () => {
  const client = new DesktopClient(); const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => { controller.abort(); throw new Error("private abort"); }));
  expect(await client.verifyCredentialCandidate("vxlk_candidate", controller.signal)).toMatchObject({ ok: false, failureKind: "canceled" });
});
